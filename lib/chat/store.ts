import { and, asc, desc, eq, sum } from "drizzle-orm";
import type { UIMessage } from "ai";
import "server-only";
import { roundCostUsd } from "@/lib/ai/pricing";
import { db } from "@/lib/db";
import {
  conversations,
  messages,
  type Conversation,
} from "@/lib/db/schema";
import { generateConversationTitle } from "./title";
import type { ConversationSummary, ConversationUsage } from "./types";
import { EMPTY_CONVERSATION_USAGE } from "./types";
import { toMessageContent, toUIMessage } from "./ui-message";

export type { ConversationSummary, ConversationUsage } from "./types";
export { EMPTY_CONVERSATION_USAGE } from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID_RE.test(value);
}

export function toConversationSummary(
  conversation: Conversation,
): ConversationSummary {
  return {
    id: conversation.id,
    title: conversation.title,
    pinned: conversation.pinned,
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

export async function listConversations(userId: string) {
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.pinned), desc(conversations.updatedAt));

  return rows.map(toConversationSummary);
}

export async function getConversationForUser(id: string, userId: string) {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .limit(1);

  return conversation ?? null;
}

export async function updateConversation({
  id,
  userId,
  pinned,
  title,
}: {
  id: string;
  userId: string;
  pinned?: boolean;
  title?: string;
}) {
  const values: { pinned?: boolean; title?: string } = {};

  if (pinned !== undefined) {
    values.pinned = pinned;
  }

  if (title !== undefined) {
    values.title = title;
  }

  if (Object.keys(values).length === 0) {
    const conversation = await getConversationForUser(id, userId);
    return conversation ? toConversationSummary(conversation) : null;
  }

  const [updated] = await db
    .update(conversations)
    .set(values)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .returning();

  return updated ? toConversationSummary(updated) : null;
}

export async function deleteConversation({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  const [deleted] = await db
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .returning({ id: conversations.id });

  return Boolean(deleted);
}

export async function getConversationUsage(
  conversationId: string,
): Promise<ConversationUsage> {
  const [row] = await db
    .select({
      tokensIn: sum(messages.tokensIn),
      tokensOut: sum(messages.tokensOut),
      tokensCached: sum(messages.tokensCached),
      tokensCacheWrite: sum(messages.tokensCacheWrite),
      costUsd: sum(messages.costUsd),
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId));

  if (!row) {
    return EMPTY_CONVERSATION_USAGE;
  }

  return {
    tokensIn: Number(row.tokensIn ?? 0) || 0,
    tokensOut: Number(row.tokensOut ?? 0) || 0,
    tokensCached: Number(row.tokensCached ?? 0) || 0,
    tokensCacheWrite: Number(row.tokensCacheWrite ?? 0) || 0,
    costUsd: roundCostUsd(Number(row.costUsd ?? 0) || 0),
  };
}

export async function listConversationMessages(conversationId: string) {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt), asc(messages.id));

  return rows.flatMap((row) => {
    const message = toUIMessage(row);
    return message ? [message] : [];
  });
}

export async function ensureConversation({
  id,
  userId,
  firstUserText,
}: {
  id: string;
  userId: string;
  firstUserText: string;
}) {
  const existing = await getConversationForUser(id, userId);

  if (existing) {
    return { conversation: existing, created: false };
  }

  const taken = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);

  if (taken[0]) {
    throw new Error("Conversation not found");
  }

  const title = await generateConversationTitle(firstUserText);
  const [conversation] = await db
    .insert(conversations)
    .values({ id, userId, title })
    .returning();

  return { conversation, created: true };
}

async function touchConversation(conversationId: string) {
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}

export async function saveUserMessage({
  conversationId,
  message,
}: {
  conversationId: string;
  message: UIMessage;
}) {
  await saveIncomingMessage({ conversationId, message });
}

export async function saveSystemMessage({
  conversationId,
  message,
}: {
  conversationId: string;
  message: UIMessage;
}) {
  await saveIncomingMessage({ conversationId, message });
}

async function saveIncomingMessage({
  conversationId,
  message,
}: {
  conversationId: string;
  message: UIMessage;
}) {
  if (message.role !== "user" && message.role !== "system") {
    return;
  }

  await db
    .insert(messages)
    .values({
      id: message.id,
      conversationId,
      role: message.role,
      content: toMessageContent(message),
    })
    .onConflictDoNothing({ target: messages.id });

  await touchConversation(conversationId);
}

export async function saveAssistantMessage({
  conversationId,
  message,
  tokensIn,
  tokensOut,
  tokensCached,
  tokensCacheWrite,
  costUsd,
  isContinuation,
}: {
  conversationId: string;
  message: UIMessage;
  tokensIn?: number;
  tokensOut?: number;
  tokensCached?: number;
  tokensCacheWrite?: number;
  costUsd?: number;
  isContinuation: boolean;
}) {
  const values = {
    content: toMessageContent(message),
    ...(tokensIn != null ? { tokensIn } : {}),
    ...(tokensOut != null ? { tokensOut } : {}),
    ...(tokensCached != null ? { tokensCached } : {}),
    ...(tokensCacheWrite != null ? { tokensCacheWrite } : {}),
    ...(costUsd != null ? { costUsd } : {}),
  };

  if (isContinuation) {
    await db.update(messages).set(values).where(eq(messages.id, message.id));
  } else {
    await db
      .insert(messages)
      .values({
        id: message.id,
        conversationId,
        role: "assistant",
        ...values,
      })
      .onConflictDoUpdate({
        target: messages.id,
        set: values,
      });
  }

  await touchConversation(conversationId);
}
