/** 5-minute Anthropic prompt cache breakpoint. Put this on the last tool and the static system prompt. */
export const ANTHROPIC_CACHE_CONTROL = {
  anthropic: {
    cacheControl: { type: "ephemeral" as const },
  },
};
