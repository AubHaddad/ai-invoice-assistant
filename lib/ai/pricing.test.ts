import { describe, expect, it } from "vitest";
import {
  computeMessageCost,
  formatUsd,
  pricesForModel,
  usageFromLanguageModel,
} from "./pricing";

describe("pricesForModel", () => {
  it("uses Haiku cache rates for the chat fast model", () => {
    expect(pricesForModel("claude-haiku-4-5")).toEqual({
      input: 1,
      output: 5,
      cacheRead: 0.1,
      cacheWrite: 1.25,
    });
  });
});

describe("usageFromLanguageModel", () => {
  it("reads cached input tokens from usage details", () => {
    expect(
      usageFromLanguageModel({
        inputTokens: 5000,
        inputTokenDetails: {
          noCacheTokens: 800,
          cacheReadTokens: 4000,
          cacheWriteTokens: 200,
        },
        outputTokens: 120,
        outputTokenDetails: {
          textTokens: 120,
          reasoningTokens: undefined,
        },
        totalTokens: 5120,
      }),
    ).toEqual({
      tokensIn: 5000,
      tokensOut: 120,
      tokensCached: 4000,
      tokensCacheWrite: 200,
      tokensUncached: 800,
    });
  });
});

describe("computeMessageCost", () => {
  it("prices cache reads cheaper than uncached input", () => {
    const cost = computeMessageCost({
      modelId: "claude-haiku-4-5",
      usage: {
        inputTokens: 5000,
        inputTokenDetails: {
          noCacheTokens: 1000,
          cacheReadTokens: 4000,
          cacheWriteTokens: 0,
        },
        outputTokens: 0,
        outputTokenDetails: {
          textTokens: 0,
          reasoningTokens: undefined,
        },
        totalTokens: 5000,
      },
    });

    expect(cost.tokensCached).toBe(4000);
    expect(cost.costUsd).toBe(0.0014);
    expect(cost.uncachedCostUsd).toBe(0.005);
    expect(cost.costUsd).toBeLessThan(cost.uncachedCostUsd);
  });

  it("prices a cache write at the 5-minute Anthropic rate", () => {
    const cost = computeMessageCost({
      modelId: "claude-haiku-4-5",
      usage: {
        inputTokens: 4096,
        inputTokenDetails: {
          noCacheTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 4096,
        },
        outputTokens: 0,
        outputTokenDetails: {
          textTokens: 0,
          reasoningTokens: undefined,
        },
        totalTokens: 4096,
      },
    });

    expect(cost.tokensCacheWrite).toBe(4096);
    expect(cost.costUsd).toBe(0.00512);
    expect(cost.uncachedCostUsd).toBe(0.004096);
    expect(cost.costUsd).toBeGreaterThan(cost.uncachedCostUsd);
  });
});

describe("formatUsd", () => {
  it("shows extra precision for sub-cent amounts", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(0.0014)).toBe("$0.0014");
    expect(formatUsd(0.042)).toBe("$0.042");
  });
});
