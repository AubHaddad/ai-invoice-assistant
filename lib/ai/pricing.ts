import type { LanguageModelUsage } from "ai";

/** USD per million tokens. Cache write is the 5-minute Anthropic rate (1.25x input). */
export type ModelTokenPrices = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
};

export const MODEL_PRICES = {
  "claude-haiku-4-5": {
    input: 1,
    output: 5,
    cacheRead: 0.1,
    cacheWrite: 1.25,
  },
  "claude-sonnet-4-6": {
    input: 3,
    output: 15,
    cacheRead: 0.3,
    cacheWrite: 3.75,
  },
  "gpt-5.4-nano": {
    input: 0.1,
    output: 0.4,
    cacheRead: 0.025,
    cacheWrite: 0.1,
  },
  "gpt-5.4-mini": {
    input: 0.4,
    output: 1.6,
    cacheRead: 0.1,
    cacheWrite: 0.4,
  },
  "gpt-5.4": {
    input: 2.5,
    output: 10,
    cacheRead: 0.625,
    cacheWrite: 2.5,
  },
} as const satisfies Record<string, ModelTokenPrices>;

const COST_DECIMAL_PLACES = 6;

export type MessageTokenUsage = {
  tokensIn: number;
  tokensOut: number;
  tokensCached: number;
  tokensCacheWrite: number;
  tokensUncached: number;
};

export type MessageCost = MessageTokenUsage & {
  modelId: string;
  costUsd: number;
  uncachedCostUsd: number;
};

function truncTokens(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.trunc(value);
}

export function pricesForModel(modelId: string): ModelTokenPrices {
  const exact = MODEL_PRICES[modelId as keyof typeof MODEL_PRICES];

  if (exact) {
    return exact;
  }

  const id = modelId.toLowerCase();

  if (id.includes("haiku")) {
    return MODEL_PRICES["claude-haiku-4-5"];
  }

  if (id.includes("sonnet")) {
    return MODEL_PRICES["claude-sonnet-4-6"];
  }

  if (id.includes("nano")) {
    return MODEL_PRICES["gpt-5.4-nano"];
  }

  if (id.includes("mini")) {
    return MODEL_PRICES["gpt-5.4-mini"];
  }

  if (id.includes("gpt")) {
    return MODEL_PRICES["gpt-5.4"];
  }

  return MODEL_PRICES["claude-haiku-4-5"];
}

export function usageFromLanguageModel(
  usage: LanguageModelUsage | undefined,
): MessageTokenUsage {
  const tokensIn = truncTokens(usage?.inputTokens);
  const tokensOut = truncTokens(usage?.outputTokens);
  const tokensCached = truncTokens(usage?.inputTokenDetails?.cacheReadTokens);
  const tokensCacheWrite = truncTokens(
    usage?.inputTokenDetails?.cacheWriteTokens,
  );
  const noCache = usage?.inputTokenDetails?.noCacheTokens;
  const tokensUncached =
    noCache == null
      ? Math.max(0, tokensIn - tokensCached - tokensCacheWrite)
      : truncTokens(noCache);

  return {
    tokensIn,
    tokensOut,
    tokensCached,
    tokensCacheWrite,
    tokensUncached,
  };
}

function usdFromMillionTokens(tokens: number, pricePerMillion: number) {
  return (tokens * pricePerMillion) / 1_000_000;
}

export function roundCostUsd(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  const factor = 10 ** COST_DECIMAL_PLACES;
  return Math.round(value * factor) / factor;
}

export function roundCostDeltaUsd(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** COST_DECIMAL_PLACES;
  return Math.round(value * factor) / factor;
}

export function computeMessageCost({
  modelId,
  usage,
}: {
  modelId: string;
  usage: LanguageModelUsage | undefined;
}): MessageCost {
  const tokens = usageFromLanguageModel(usage);
  const prices = pricesForModel(modelId);
  const costUsd = roundCostUsd(
    usdFromMillionTokens(tokens.tokensUncached, prices.input) +
      usdFromMillionTokens(tokens.tokensCached, prices.cacheRead) +
      usdFromMillionTokens(tokens.tokensCacheWrite, prices.cacheWrite) +
      usdFromMillionTokens(tokens.tokensOut, prices.output),
  );
  const uncachedCostUsd = roundCostUsd(
    usdFromMillionTokens(tokens.tokensIn, prices.input) +
      usdFromMillionTokens(tokens.tokensOut, prices.output),
  );

  return {
    modelId,
    ...tokens,
    costUsd,
    uncachedCostUsd,
  };
}

export function formatUsd(amount: number) {
  if (amount <= 0) {
    return "$0.00";
  }

  if (amount < 0.01) {
    return `$${amount.toFixed(4)}`;
  }

  return `$${amount.toFixed(3)}`;
}
