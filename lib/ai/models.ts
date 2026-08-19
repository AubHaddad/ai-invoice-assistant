import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { wrapLanguageModel, type LanguageModel } from "ai";
import "server-only";
import { withFallback } from "@/lib/ai/retry";
import { logFailureToLangfuse } from "@/lib/observability/log-failure";

export type ModelTier = "cheap" | "fast" | "smart";
export type ModelProvider = "anthropic" | "openai";

export { withFallback } from "@/lib/ai/retry";

const PROVIDERS = ["anthropic", "openai"] as const;

const DEFAULT_PRIMARY_PROVIDER: ModelProvider = "anthropic";
const DEFAULT_FALLBACK_PROVIDER: ModelProvider = "openai";

const DEFAULT_MODELS: Record<ModelProvider, Record<ModelTier, string>> = {
  anthropic: {
    cheap: "claude-haiku-4-5",
    fast: "claude-haiku-4-5",
    smart: "claude-sonnet-4-6",
  },
  openai: {
    cheap: "gpt-5.4-nano",
    fast: "gpt-5.4-mini",
    smart: "gpt-5.4",
  },
};

const MODEL_ENV: Record<ModelProvider, Record<ModelTier, string>> = {
  anthropic: {
    cheap: "AI_ANTHROPIC_CHEAP_MODEL",
    fast: "AI_ANTHROPIC_FAST_MODEL",
    smart: "AI_ANTHROPIC_SMART_MODEL",
  },
  openai: {
    cheap: "AI_OPENAI_CHEAP_MODEL",
    fast: "AI_OPENAI_FAST_MODEL",
    smart: "AI_OPENAI_SMART_MODEL",
  },
};

function readEnv(name: string) {
  return process.env[name]?.trim() || undefined;
}

function isModelProvider(value: string): value is ModelProvider {
  return (PROVIDERS as readonly string[]).includes(value);
}

function readProvider(name: string, fallback: ModelProvider): ModelProvider {
  const value = readEnv(name)?.toLowerCase();

  if (!value) {
    return fallback;
  }

  if (!isModelProvider(value)) {
    throw new Error(`${name} must be "anthropic" or "openai", received "${value}"`);
  }

  return value;
}

function readModelId(provider: ModelProvider, tier: ModelTier) {
  return readEnv(MODEL_ENV[provider][tier]) ?? DEFAULT_MODELS[provider][tier];
}

function createProviderModel(provider: ModelProvider, modelId: string) {
  switch (provider) {
    case "anthropic":
      return anthropic(modelId);
    case "openai":
      return openai(modelId);
  }
}

function logProviderFailure(error: unknown, stage: "retry" | "fallback") {
  logFailureToLangfuse({
    source: "provider",
    error,
    extra: { stage },
  });
}

/**
 * Anthropic by default, OpenAI as fallback. Provider and model IDs are read
 * from env on each call so they can change without a rebuild.
 */
export function getModel(tier: ModelTier): LanguageModel {
  const primaryProvider = readProvider("AI_PRIMARY_PROVIDER", DEFAULT_PRIMARY_PROVIDER);
  const fallbackProvider = readProvider("AI_FALLBACK_PROVIDER", DEFAULT_FALLBACK_PROVIDER);

  const primary = createProviderModel(primaryProvider, readModelId(primaryProvider, tier));
  const fallback = wrapLanguageModel({
    model: createProviderModel(fallbackProvider, readModelId(fallbackProvider, tier)),
    middleware: [],
  });

  return wrapLanguageModel({
    model: primary,
    middleware: {
      wrapGenerate: ({ doGenerate, params }) =>
        withFallback(
          () => doGenerate(),
          () => fallback.doGenerate(params),
          { onFailure: logProviderFailure },
        ),
      wrapStream: ({ doStream, params }) =>
        withFallback(
          () => doStream(),
          () => fallback.doStream(params),
          { onFailure: logProviderFailure },
        ),
    },
  });
}
