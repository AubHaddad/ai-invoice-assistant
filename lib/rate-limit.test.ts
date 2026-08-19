import { describe, expect, it } from "vitest";
import {
  ChatLimitError,
  RATE_LIMIT_MESSAGE,
  TOKEN_BUDGET_MESSAGE,
  dailyTokenKey,
  enforceChatLimits,
  nextUtcMidnight,
  recordChatTokenUsage,
  toUsedTokens,
  utcDateKey,
  chatLimitResponse,
  type ChatLimiter,
  type RedisCommands,
} from "./rate-limit";

class MemoryRedis implements RedisCommands {
  readonly store = new Map<string, { value: number; expiresAt?: number }>();

  constructor(private readonly now: () => Date) {}

  async get(key: string) {
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt != null && this.now().getTime() >= entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async incrby(key: string, increment: number) {
    const current = toUsedTokens(await this.get(key));
    const value = current + increment;
    const existing = this.store.get(key);

    this.store.set(key, { value, expiresAt: existing?.expiresAt });

    return value;
  }

  async expire(key: string, seconds: number) {
    const entry = this.store.get(key);

    if (!entry) {
      return 0;
    }

    entry.expiresAt = this.now().getTime() + seconds * 1000;
    return 1;
  }
}

function createLimiter({
  allowRequests = true,
  reset = Date.parse("2026-08-19T21:01:00.000Z"),
  dailyTokenBudget = 1_000,
  now = () => new Date("2026-08-19T20:30:00.000Z"),
}: {
  allowRequests?: boolean;
  reset?: number;
  dailyTokenBudget?: number;
  now?: () => Date;
} = {}): ChatLimiter & { redis: MemoryRedis } {
  const redis = new MemoryRedis(now);

  return {
    redis,
    requestLimiter: {
      limit: async () => ({
        success: allowRequests,
        reset,
        pending: Promise.resolve(),
      }),
    },
    dailyTokenBudget,
    now,
  };
}

describe("chatLimitResponse", () => {
  it("returns 429 with the friendly message and Retry-After", async () => {
    const response = chatLimitResponse(
      new ChatLimitError(
        "rate_limit",
        RATE_LIMIT_MESSAGE,
        new Date("2026-08-19T21:01:00.000Z"),
      ),
    );
    const body = (await response.json()) as { error: string; code: string };

    expect(response.status).toBe(429);
    expect(body).toEqual({
      error: RATE_LIMIT_MESSAGE,
      code: "rate_limit",
    });
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});

describe("daily token keys", () => {
  it("uses the UTC date so the budget resets at midnight UTC", () => {
    const beforeMidnight = new Date("2026-08-19T23:59:59.000Z");
    const afterMidnight = new Date("2026-08-20T00:00:00.000Z");

    expect(utcDateKey(beforeMidnight)).toBe("2026-08-19");
    expect(utcDateKey(afterMidnight)).toBe("2026-08-20");
    expect(nextUtcMidnight(beforeMidnight).toISOString()).toBe(
      "2026-08-20T00:00:00.000Z",
    );
    expect(dailyTokenKey("user-1", beforeMidnight)).not.toBe(
      dailyTokenKey("user-1", afterMidnight),
    );
  });
});

describe("enforceChatLimits", () => {
  it("blocks a user who exceeds the sliding-window request limit", async () => {
    const limiter = createLimiter({ allowRequests: false });

    await expect(enforceChatLimits("user-1", limiter)).rejects.toMatchObject({
      name: "ChatLimitError",
      code: "rate_limit",
      message: RATE_LIMIT_MESSAGE,
    });
  });

  it("blocks a user who has already used the daily token budget", async () => {
    const limiter = createLimiter({ dailyTokenBudget: 500 });
    await limiter.redis.incrby(dailyTokenKey("user-1", limiter.now!()), 500);

    await expect(enforceChatLimits("user-1", limiter)).rejects.toBeInstanceOf(
      ChatLimitError,
    );
    await expect(enforceChatLimits("user-1", limiter)).rejects.toMatchObject({
      code: "token_budget",
      message: TOKEN_BUDGET_MESSAGE,
    });
  });

  it("allows a request when both limits have remaining budget", async () => {
    const limiter = createLimiter({ dailyTokenBudget: 500 });
    await limiter.redis.incrby(dailyTokenKey("user-1", limiter.now!()), 499);

    await expect(enforceChatLimits("user-1", limiter)).resolves.toEqual({
      pending: expect.any(Promise),
    });
  });
});

describe("recordChatTokenUsage", () => {
  it("increments the per-user daily total and expires it at midnight UTC", async () => {
    const now = () => new Date("2026-08-19T20:30:00.000Z");
    const limiter = createLimiter({ now });

    await expect(recordChatTokenUsage("user-1", 120, limiter)).resolves.toBe(120);
    await expect(recordChatTokenUsage("user-1", 30, limiter)).resolves.toBe(150);
    expect(await limiter.redis.get(dailyTokenKey("user-1", now()))).toBe(150);

    const stored = limiter.redis.store.get(dailyTokenKey("user-1", now()));
    expect(stored?.expiresAt).toBe(Date.parse("2026-08-20T00:00:00.000Z"));
  });

  it("starts a new counter after the UTC date rolls over", async () => {
    let current = new Date("2026-08-19T23:59:00.000Z");
    const limiter = createLimiter({ now: () => current });

    await recordChatTokenUsage("user-1", 80, limiter);
    expect(await limiter.redis.get(dailyTokenKey("user-1", current))).toBe(80);

    current = new Date("2026-08-20T00:00:00.000Z");
    await recordChatTokenUsage("user-1", 10, limiter);

    expect(await limiter.redis.get(dailyTokenKey("user-1", current))).toBe(10);
  });
});
