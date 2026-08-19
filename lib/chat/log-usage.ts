import { propagateAttributes, startObservation } from "@langfuse/tracing";
import "server-only";
import { roundCostDeltaUsd, type MessageCost } from "@/lib/ai/pricing";

export const PROMPT_CACHE_TAG = "prompt-cache";

/** Actual vs uncached cost so cache savings are comparable in Langfuse. */
export function logMessageUsageToLangfuse(cost: MessageCost) {
  const usedCache = cost.tokensCached > 0 || cost.tokensCacheWrite > 0;
  const cacheSavingsUsd = roundCostDeltaUsd(cost.uncachedCostUsd - cost.costUsd);

  try {
    propagateAttributes(
      usedCache ? { tags: [PROMPT_CACHE_TAG] } : {},
      () => {
        startObservation(
          "message-usage",
          {
            metadata: {
              modelId: cost.modelId,
              tokensIn: cost.tokensIn,
              tokensOut: cost.tokensOut,
              cacheReadTokens: cost.tokensCached,
              cacheWriteTokens: cost.tokensCacheWrite,
              tokensUncached: cost.tokensUncached,
              costUsd: cost.costUsd,
              uncachedCostUsd: cost.uncachedCostUsd,
              cacheSavingsUsd,
            },
          },
          { asType: "event" },
        );
      },
    );
  } catch (error) {
    console.error("Failed to log message usage to Langfuse", error);
  }
}
