import { generateText } from "ai";
import "server-only";
import { getModel } from "@/lib/ai/models";
import { logFailureToLangfuse } from "@/lib/observability/log-failure";

const TITLE_MAX_CHARS = 48;

export function fallbackTitle(userText: string) {
  const compact = userText.trim().replace(/\s+/g, " ");

  if (!compact) {
    return "New chat";
  }

  return compact.length <= TITLE_MAX_CHARS
    ? compact
    : `${compact.slice(0, TITLE_MAX_CHARS - 1).trimEnd()}…`;
}

function sanitizeGeneratedTitle(title: string, fallback: string) {
  const compact = title
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.?!]+$/g, "");

  if (!compact) {
    return fallback;
  }

  const wordCount = compact.split(" ").length;

  if (
    wordCount > 8 ||
    compact.includes("?") ||
    /^(i don't|i do not|i can't|sorry|could you|please share)/i.test(compact)
  ) {
    return fallback;
  }

  return compact.slice(0, 80);
}

function titlePrompt({
  userText,
  assistantText,
  fileNames,
}: {
  userText: string;
  assistantText: string;
  fileNames: string[];
}) {
  const files = fileNames.length > 0 ? fileNames.join(", ") : "none";

  return [
    "User message:",
    userText.trim().slice(0, 400) || "(empty)",
    `Attached files: ${files}`,
    "Assistant reply:",
    assistantText.trim().slice(0, 800) || "(empty)",
  ].join("\n");
}

export async function generateConversationTitle({
  userText,
  assistantText,
  fileNames = [],
}: {
  userText: string;
  assistantText: string;
  fileNames?: string[];
}) {
  const fallback = fallbackTitle(userText);

  if (
    process.env["E2E_TEST_AUTH"] === "1" ||
    process.env["EVAL_TEST_AUTH"] === "1"
  ) {
    return fallback;
  }

  try {
    const { text } = await generateText({
      model: getModel("fast"),
      maxRetries: 0,
      timeout: 8_000,
      maxOutputTokens: 24,
      temperature: 0.2,
      instructions:
        "You name chat conversations. Return only a short title of at most 6 words. Prefer the vendor, invoice number, or file name when those appear. Never answer the user, never ask for a file, and do not use quotes.",
      prompt: titlePrompt({ userText, assistantText, fileNames }),
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

    return sanitizeGeneratedTitle(text, fallback);
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
