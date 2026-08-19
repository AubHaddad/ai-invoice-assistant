import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import {
  APICallError,
  LoadAPIKeyError,
  RetryError,
  wrapLanguageModel,
  type LanguageModel,
} from "ai";
import "server-only";

export type ModelTier = "cheap" | "fast" | "smart";
export type ModelProvider = "anthropic" | "openai";

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

function isTimeoutError(error: unknown) {
  const seen = new Set<unknown>();
  let current: unknown = unwrapRetryError(error);

  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);

    const name = "name" in current ? String(current.name) : "";
    const message = "message" in current ? String(current.message) : "";

    if (name === "TimeoutError") {
      return true;
    }

    if (name === "AbortError" && /timeout/i.test(message)) {
      return true;
    }

    current = "cause" in current ? current.cause : undefined;
  }

  return false;
}

function unwrapRetryError(error: unknown) {
  return RetryError.isInstance(error) ? error.lastError : error;
}

function getErrorStatusCode(error: unknown) {
  const cause = unwrapRetryError(error);
  return APICallError.isInstance(cause) ? cause.statusCode : undefined;
}

function isTransientProviderError(error: unknown) {
  if (isTimeoutError(error)) {
    return true;
  }

  const status = getErrorStatusCode(error);
  return status === 429 || (status != null && status >= 500);
}

function isProviderUnavailableError(error: unknown) {
  const cause = unwrapRetryError(error);

  if (LoadAPIKeyError.isInstance(cause)) {
    return true;
  }

  const status = getErrorStatusCode(error);
  return status === 401 || status === 403 || isTransientProviderError(error);
}

/**
 * Retry once on 429/5xx/timeout, then switch provider.
 * Auth/missing-key failures skip the retry and switch immediately.
 */
export async function withFallback<T>(
  runPrimary: () => PromiseLike<T>,
  runFallback: () => PromiseLike<T>,
): Promise<T> {
  try {
    return await runPrimary();
  } catch (error) {
    if (isTransientProviderError(error)) {
      try {
        return await runPrimary();
      } catch (retryError) {
        if (!isProviderUnavailableError(retryError)) {
          throw retryError;
        }

        console.warn("Primary AI provider failed after retry; switching provider", retryError);
        return runFallback();
      }
    }

    if (isProviderUnavailableError(error)) {
      console.warn("Primary AI provider unavailable; switching provider", error);
      return runFallback();
    }

    throw error;
  }
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
        ),
      wrapStream: ({ doStream, params }) =>
        withFallback(
          () => doStream(),
          () => fallback.doStream(params),
        ),
    },
  });
}
