import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import "server-only";

const TITLE_MODEL = anthropic("claude-haiku-4-5");

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
      model: TITLE_MODEL,
      maxOutputTokens: 24,
      temperature: 0.2,
      instructions:
        "Generate a short conversation title of at most 6 words. No quotes, no trailing punctuation, no extra commentary.",
      prompt: userText.trim().slice(0, 400) || "New chat",
    });

    const title = text
      .trim()
      .replace(/^["'`]+|["'`]+$/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 80);

    return title || fallback;
  } catch (error) {
    console.error("Failed to generate conversation title", error);
    return fallback;
  }
}
