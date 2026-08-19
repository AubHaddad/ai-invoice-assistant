import { generateText } from "ai";
import "server-only";
import { getModel } from "@/lib/ai/models";
import { logFailureToLangfuse } from "@/lib/observability/log-failure";

export function fallbackTitle(userText: string) {
  const compact = userText.trim().replace(/\s+/g, " ");

  if (!compact) {
    return "New chat";
  }

  return compact.length <= 48 ? compact : `${compact.slice(0, 45).trimEnd()}…`;
}

export async function generateConversationTitle(userText: string) {
  const fallback = fallbackTitle(userText);

  try {
    const { text } = await generateText({
      model: getModel("fast"),
      maxRetries: 0,
      timeout: 8_000,
      maxOutputTokens: 24,
      temperature: 0.2,
      instructions:
        "Generate a short conversation title of at most 6 words. No quotes, no trailing punctuation, no extra commentary.",
      prompt: userText.trim().slice(0, 400) || "New chat",
      runtimeContext: {
        feature: "title",
      },
      telemetry: {
        functionId: "generate-conversation-title",
        includeRuntimeContext: {
          feature: true,
        },
      },
    });

    const title = text
      .trim()
      .replace(/^["'`]+|["'`]+$/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 80);

    return title || fallback;
  } catch (error) {
    console.error("Failed to generate conversation title", error);
    logFailureToLangfuse({
      source: "provider",
      error,
      extra: { feature: "title" },
    });
    return fallback;
  }
}
