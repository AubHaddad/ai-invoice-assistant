export const DEFAULT_REQUESTS_PER_MINUTE = 20;
export const DEFAULT_DAILY_TOKEN_BUDGET = 200_000;

export const RATE_LIMIT_MESSAGE =
  "You're sending messages too quickly. Please wait a minute and try again.";
export const TOKEN_BUDGET_MESSAGE =
  "You've reached today's chat usage limit. It resets at midnight UTC.";

export type ChatLimitCode = "rate_limit" | "token_budget";

export type RedisCommands = {
  get: (key: string) => Promise<unknown>;
  incrby: (key: string, increment: number) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<unknown>;
};

export type RequestLimiter = {
  limit: (identifier: string) => Promise<{
    success: boolean;
    reset: number;
    pending: Promise<unknown>;
  }>;
};

export type ChatLimiter = {
  redis: RedisCommands;
  requestLimiter: RequestLimiter;
  dailyTokenBudget: number;
  now?: () => Date;
};

export class ChatLimitError extends Error {
  readonly code: ChatLimitCode;
  readonly resetAt: Date;

  constructor(code: ChatLimitCode, message: string, resetAt: Date) {
    super(message);
    this.name = "ChatLimitError";
    this.code = code;
    this.resetAt = resetAt;
  }
}

const globalForLimiter = globalThis as unknown as {
  chatLimiter: ChatLimiter | undefined;
};

export function utcDateKey(now: Date) {
  return now.toISOString().slice(0, 10);
}

export function nextUtcMidnight(now: Date) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
}

export function dailyTokenKey(userId: string, now: Date) {
  return `chat:tokens:${userId}:${utcDateKey(now)}`;
}

export function toUsedTokens(value: unknown) {
  const tokens = typeof value === "string" ? Number(value) : Number(value);

  if (!Number.isFinite(tokens) || tokens < 0) {
    return 0;
  }

  return Math.trunc(tokens);
}

function readPositiveInt(name: string, fallback: number) {
  const raw = process.env[name]?.trim();

  if (!raw) {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }

  return Math.trunc(value);
}

async function getDefaultLimiter(): Promise<ChatLimiter> {
  if (globalForLimiter.chatLimiter) {
    return globalForLimiter.chatLimiter;
  }

  const [{ Ratelimit }, { getRedis }] = await Promise.all([
    import("@upstash/ratelimit"),
    import("@/lib/redis"),
  ]);

  const redis = getRedis();
  const limiter: ChatLimiter = {
    redis,
    requestLimiter: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        readPositiveInt("CHAT_REQUESTS_PER_MINUTE", DEFAULT_REQUESTS_PER_MINUTE),
        "1 m",
      ),
      prefix: "chat:rpm",
    }),
    dailyTokenBudget: readPositiveInt(
      "CHAT_DAILY_TOKEN_BUDGET",
      DEFAULT_DAILY_TOKEN_BUDGET,
    ),
  };

  if (process.env.NODE_ENV !== "production") {
    globalForLimiter.chatLimiter = limiter;
  }

  return limiter;
}

export function chatLimitResponse(error: ChatLimitError) {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((error.resetAt.getTime() - Date.now()) / 1000),
  );

  return Response.json(
    { error: error.message, code: error.code },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

export async function enforceChatLimits(
  userId: string,
  limiter?: ChatLimiter,
) {
  const resolved = limiter ?? (await getDefaultLimiter());
  const now = resolved.now?.() ?? new Date();
  const requestLimit = await resolved.requestLimiter.limit(userId);

  if (!requestLimit.success) {
    throw new ChatLimitError(
      "rate_limit",
      RATE_LIMIT_MESSAGE,
      new Date(requestLimit.reset),
    );
  }

  const used = toUsedTokens(
    await resolved.redis.get(dailyTokenKey(userId, now)),
  );

  if (used >= resolved.dailyTokenBudget) {
    throw new ChatLimitError(
      "token_budget",
      TOKEN_BUDGET_MESSAGE,
      nextUtcMidnight(now),
    );
  }

  return { pending: requestLimit.pending };
}

export async function recordChatTokenUsage(
  userId: string,
  tokens: number,
  limiter?: ChatLimiter,
) {
  const increment = toUsedTokens(tokens);

  if (increment === 0) {
    return 0;
  }

  const resolved = limiter ?? (await getDefaultLimiter());
  const now = resolved.now?.() ?? new Date();
  const key = dailyTokenKey(userId, now);
  const used = await resolved.redis.incrby(key, increment);
  const ttlSeconds = Math.max(
    1,
    Math.ceil((nextUtcMidnight(now).getTime() - now.getTime()) / 1000),
  );

  await resolved.redis.expire(key, ttlSeconds);

  return used;
}
