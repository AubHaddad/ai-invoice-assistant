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
import { getModel, getPrimaryModelId } from "@/lib/ai/models";
import { computeMessageCost } from "@/lib/ai/pricing";
import { getCurrentUserId } from "@/lib/auth/session";
import {
  DEFAULT_CHAT_ERROR_MESSAGE,
  toPublicErrorMessage,
} from "@/lib/chat/error-message";
import { logAgentStepToLangfuse } from "@/lib/chat/log-step";
import { logMessageUsageToLangfuse } from "@/lib/chat/log-usage";
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
import {
  cachedChatInstructions,
  conversationContextMessage,
  systemInstructionsText,
} from "@/lib/chat/system-prompt";
import { invoiceAssistantTools } from "@/lib/chat/tools";
import { truncateMessages } from "@/lib/chat/truncate";
import { getMessageText } from "@/lib/chat/ui-message";
import type { InvoiceAssistantUIMessage } from "@/lib/chat/types";
import {
  attachDocumentsToConversation,
  listUploadedDocumentsForConversation,
} from "@/lib/documents/store";
import { e2eChatResponse } from "@/lib/e2e/chat";
import { isE2ETestAuth, skipChatRateLimit } from "@/lib/e2e/env";
import { langfuseSpanProcessor } from "@/lib/observability/langfuse";
import { logFailureToLangfuse } from "@/lib/observability/log-failure";
import {
  ChatLimitError,
  chatLimitResponse,
  enforceChatLimits,
  recordChatTokenUsage,
} from "@/lib/rate-limit";

export const maxDuration = 60;

function failureResponse(error: unknown, extra?: Record<string, unknown>) {
  logFailureToLangfuse({
    source: "route",
    error,
    extra,
  });
  console.error("Chat request failed", error);

  return Response.json(
    { error: toPublicErrorMessage(error, DEFAULT_CHAT_ERROR_MESSAGE) },
    { status: 503 },
  );
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

  if (!skipChatRateLimit()) {
    try {
      const { pending } = await enforceChatLimits(userId);
      after(() => pending);
    } catch (error) {
      if (error instanceof ChatLimitError) {
        return chatLimitResponse(error);
      }

      return failureResponse(error, { stage: "rate-limit" });
    }
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

    return failureResponse(error, { stage: "ensure-conversation" });
  }

  try {
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
    const instructions = cachedChatInstructions(
      conversationContextMessage({
        documents: uploadedDocuments,
        notes: systemNotes,
      }),
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

    if (isE2ETestAuth()) {
      return e2eChatResponse({
        userId,
        conversationId,
        messages: messages as InvoiceAssistantUIMessage[],
      });
    }

    const truncatedMessages = truncateMessages({
      messages: conversationMessages,
      systemPrompt: systemInstructionsText(instructions),
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
        let modelId = getPrimaryModelId("fast");

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
          onError: ({ error }) => {
            logFailureToLangfuse({
              source: "stream",
              error,
              extra: { conversationId },
            });
          },
          onEnd: (event) => {
            usage = event.usage;
            modelId =
              event.finalStep.model.modelId ||
              event.response?.modelId ||
              modelId;
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
            onError: (error) => toPublicErrorMessage(error),
            onFinish: async ({ responseMessage, isContinuation }) => {
              const resolvedUsage =
                usage ??
                (await Promise.resolve(result.usage).catch(() => undefined));
              const cost = computeMessageCost({
                modelId,
                usage: resolvedUsage,
              });
              const tokensUsed = cost.tokensIn + cost.tokensOut;

              try {
                await saveAssistantMessage({
                  conversationId,
                  message: responseMessage,
                  tokensIn: cost.tokensIn,
                  tokensOut: cost.tokensOut,
                  tokensCached: cost.tokensCached,
                  tokensCacheWrite: cost.tokensCacheWrite,
                  costUsd: cost.costUsd,
                  isContinuation,
                });
              } catch (error) {
                console.error("Failed to persist assistant message", error);
                logFailureToLangfuse({
                  source: "db",
                  error,
                  extra: { stage: "save-assistant-message" },
                });
              }

              logMessageUsageToLangfuse(cost);

              if (tokensUsed > 0) {
                try {
                  await recordChatTokenUsage(userId, tokensUsed);
                } catch (error) {
                  console.error("Failed to record chat token usage", error);
                  logFailureToLangfuse({
                    source: "db",
                    error,
                    extra: { stage: "record-token-usage" },
                  });
                }
              }
            },
          }),
        });
      },
    );
  } catch (error) {
    return failureResponse(error, { stage: "chat" });
  }
}
