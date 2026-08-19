import type { UIMessage } from "ai";

export const MAX_HISTORY_MESSAGES = 24;
export const MAX_HISTORY_TOKENS = 8_000;
const CHARS_PER_TOKEN = 4;

function estimateTokens(value: string) {
  return Math.ceil(value.length / CHARS_PER_TOKEN);
}

function messageTokens(message: UIMessage) {
  return estimateTokens(JSON.stringify(message.parts));
}

function alignToUserMessage(messages: UIMessage[]) {
  const firstUserIndex = messages.findIndex((message) => message.role === "user");

  if (firstUserIndex <= 0) {
    return messages;
  }

  return messages.slice(firstUserIndex);
}

/**
 * Keep the system prompt plus the last N conversation messages, then drop
 * oldest turns until the estimate fits the token budget.
 */
export function truncateMessages({
  messages,
  systemPrompt,
  maxMessages = MAX_HISTORY_MESSAGES,
  maxTokens = MAX_HISTORY_TOKENS,
}: {
  messages: UIMessage[];
  systemPrompt: string;
  maxMessages?: number;
  maxTokens?: number;
}): UIMessage[] {
  const systemMessages = messages.filter((message) => message.role === "system");
  const conversation = messages.filter((message) => message.role !== "system");
  let kept = alignToUserMessage(conversation.slice(-maxMessages));

  const reservedTokens =
    estimateTokens(systemPrompt) +
    systemMessages.reduce((total, message) => total + messageTokens(message), 0);

  const totalTokens = () =>
    reservedTokens + kept.reduce((total, message) => total + messageTokens(message), 0);

  while (kept.length > 1 && totalTokens() > maxTokens) {
    kept = alignToUserMessage(kept.slice(1));
  }

  return [...systemMessages, ...kept];
}
