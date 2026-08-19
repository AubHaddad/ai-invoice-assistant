import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type LanguageModelUsage,
  type UIMessage,
} from "ai";
import { propagateAttributes } from "@langfuse/tracing";
import { after } from "next/server";
import { getModel } from "@/lib/ai/models";
import { getCurrentUserId } from "@/lib/auth/session";
import {
  ensureConversation,
  isUuid,
  saveAssistantMessage,
  saveUserMessage,
} from "@/lib/chat/store";
import { instructionsWithDocuments } from "@/lib/chat/system-prompt";
import { invoiceAssistantTools } from "@/lib/chat/tools";
import { truncateMessages } from "@/lib/chat/truncate";
import { getMessageText } from "@/lib/chat/ui-message";
import {
  attachDocumentsToConversation,
  listUploadedDocumentsForConversation,
} from "@/lib/documents/store";
import { langfuseSpanProcessor } from "@/lib/observability/langfuse";

export const maxDuration = 60;

function toTokenCount(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return Math.trunc(value);
}

function tokenCountsFromUsage(usage: LanguageModelUsage | undefined) {
  return {
    tokensIn: toTokenCount(usage?.inputTokens),
    tokensOut: toTokenCount(usage?.outputTokens),
  };
}

function readDocumentIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value.filter(
        (id): id is string => typeof id === "string" && isUuid(id),
      ),
    ),
  ];
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await req.json()) as {
    id?: string;
    messages?: UIMessage[];
    documentIds?: unknown;
  };

  const conversationId = body.id;
  const messages = body.messages;
  const documentIds = readDocumentIds(body.documentIds);

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

  await attachDocumentsToConversation({
    documentIds,
    conversationId,
    userId,
  });

  const uploadedDocuments = await listUploadedDocumentsForConversation(
    conversationId,
    userId,
  );
  const instructions = instructionsWithDocuments(uploadedDocuments);

  await saveUserMessage({
    conversationId,
    message: lastUserMessage,
  });

  const truncatedMessages = truncateMessages({
    messages,
    systemPrompt: instructions,
  });

  return propagateAttributes(
    {
      traceName: "generate-chat-response",
      userId,
      sessionId: conversationId,
      tags: ["chat"],
      metadata: {
        conversationId,
      },
    },
    async () => {
      let usage: LanguageModelUsage | undefined;

      const result = streamText({
        model: getModel("fast"),
        maxRetries: 0,
        instructions,
        messages: await convertToModelMessages(truncatedMessages),
        tools: invoiceAssistantTools,
        toolsContext: {
          extractInvoice: { userId },
        },
        stopWhen: isStepCount(5),
        runtimeContext: {
          userId,
          conversationId,
        },
        telemetry: {
          functionId: "generate-chat-response",
          includeRuntimeContext: {
            userId: true,
            conversationId: true,
          },
        },
        onEnd: (event) => {
          usage = event.usage;
        },
      });

      result.consumeStream();

      after(async () => {
        await langfuseSpanProcessor.forceFlush();
      });

      return createUIMessageStreamResponse({
        stream: toUIMessageStream({
          stream: result.stream,
          originalMessages: messages,
          generateMessageId: () => crypto.randomUUID(),
          onFinish: async ({ responseMessage, isContinuation }) => {
            try {
              const resolvedUsage =
                usage ??
                (await Promise.resolve(result.usage).catch(() => undefined));

              await saveAssistantMessage({
                conversationId,
                message: responseMessage,
                ...tokenCountsFromUsage(resolvedUsage),
                isContinuation,
              });
            } catch (error) {
              console.error("Failed to persist assistant message", error);
            }
          },
        }),
      });
    },
  );
}
