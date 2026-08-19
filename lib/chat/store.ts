import { and, asc, desc, eq } from "drizzle-orm";
import type { UIMessage } from "ai";
import "server-only";
import { db } from "@/lib/db";
import {
  conversations,
  messages,
  type Conversation,
} from "@/lib/db/schema";
import { generateConversationTitle } from "./title";
import type { ConversationSummary } from "./types";
import { toMessageContent, toUIMessage } from "./ui-message";

export type { ConversationSummary } from "./types";

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
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

export async function listConversations(userId: string) {
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt));

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
  isContinuation,
}: {
  conversationId: string;
  message: UIMessage;
  tokensIn?: number;
  tokensOut?: number;
  isContinuation: boolean;
}) {
  const values = {
    content: toMessageContent(message),
    tokensIn,
    tokensOut,
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
      .onConflictDoNothing({ target: messages.id });
  }

  await touchConversation(conversationId);
}
