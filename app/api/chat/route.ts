import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { getCurrentUserId } from "@/lib/auth/session";
import {
  ensureConversation,
  isUuid,
  saveAssistantMessage,
  saveUserMessage,
} from "@/lib/chat/store";
import { SYSTEM_PROMPT } from "@/lib/chat/system-prompt";
import { truncateMessages } from "@/lib/chat/truncate";
import { getMessageText } from "@/lib/chat/ui-message";

const CHAT_MODEL = anthropic("claude-haiku-4-5");

export async function POST(req: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await req.json()) as {
    id?: string;
    messages?: UIMessage[];
  };

  const conversationId = body.id;
  const messages = body.messages;

  if (!conversationId || !isUuid(conversationId)) {
    return Response.json({ error: "Invalid conversation id" }, { status: 400 });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "Messages are required" }, { status: 400 });
  }

  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");

  if (!lastUserMessage) {
    return Response.json({ error: "A user message is required" }, { status: 400 });
  }

  try {
    await ensureConversation({
      id: conversationId,
      userId,
      firstUserText: getMessageText(lastUserMessage),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Conversation not found") {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    throw error;
  }

  await saveUserMessage({
    conversationId,
    message: lastUserMessage,
  });

  const truncatedMessages = truncateMessages({
    messages,
    systemPrompt: SYSTEM_PROMPT,
  });

  const result = streamText({
    model: CHAT_MODEL,
    instructions: SYSTEM_PROMPT,
    messages: await convertToModelMessages(truncatedMessages),
  });

  result.consumeStream();

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      generateMessageId: () => crypto.randomUUID(),
      onFinish: async ({ responseMessage, isContinuation }) => {
        try {
          const usage = await result.usage;

          await saveAssistantMessage({
            conversationId,
            message: responseMessage,
            tokensIn: usage.inputTokens,
            tokensOut: usage.outputTokens,
            isContinuation,
          });
        } catch (error) {
          console.error("Failed to persist assistant message", error);
        }
      },
    }),
  });
}
