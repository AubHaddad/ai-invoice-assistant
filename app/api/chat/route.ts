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
import { logAgentStepToLangfuse } from "@/lib/chat/log-step";
import {
  AGENT_TIMEOUT,
  MAX_AGENT_STEPS,
  prepareAgentStep,
} from "@/lib/chat/loop";
import {
  ensureConversation,
  isUuid,
  saveAssistantMessage,
  saveSystemMessage,
  saveUserMessage,
} from "@/lib/chat/store";
import { instructionsWithContext, instructionsWithDocuments } from "@/lib/chat/system-prompt";
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
  const systemNotes = messages
    .filter((message) => message.role === "system")
    .map((message) => getMessageText(message))
    .filter(Boolean);
  const conversationMessages = messages.filter(
    (message) => message.role !== "system",
  );
  const instructions = instructionsWithContext(
    instructionsWithDocuments(uploadedDocuments),
    systemNotes,
  );

  await saveUserMessage({
    conversationId,
    message: lastUserMessage,
  });

  const lastMessage = messages[messages.length - 1];

  if (lastMessage?.role === "system" && isUuid(lastMessage.id)) {
    await saveSystemMessage({
      conversationId,
      message: lastMessage,
    });
  }

  const truncatedMessages = truncateMessages({
    messages: conversationMessages,
    systemPrompt: instructions,
  });
  const modelMessages = [
    ...(await convertToModelMessages(truncatedMessages)),
    ...(lastMessage?.role === "system"
      ? [
          {
            role: "user" as const,
            content: "Please confirm the invoice was saved.",
          },
        ]
      : []),
  ];

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
        messages: modelMessages,
        tools: invoiceAssistantTools,
        toolsContext: {
          extractInvoice: { userId },
          queryInvoices: { userId },
          generateReport: { userId },
        },
        timeout: AGENT_TIMEOUT,
        stopWhen: isStepCount(MAX_AGENT_STEPS),
        prepareStep: ({ stepNumber }) => prepareAgentStep({ stepNumber }),
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
        onStepEnd: (event) => {
          logAgentStepToLangfuse(event);
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
