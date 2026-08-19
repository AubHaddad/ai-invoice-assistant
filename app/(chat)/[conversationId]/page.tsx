import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ChatApp } from "@/components/chat/chat-app";
import {
  EMPTY_CONVERSATION_USAGE,
  getConversationForUser,
  getConversationUsage,
  isUuid,
  listConversationMessages,
  listConversations,
} from "@/lib/chat/store";
import type { InvoiceAssistantUIMessage } from "@/lib/chat/types";
import type { ConversationSummary, ConversationUsage } from "@/lib/chat/types";
import { logFailureToLangfuse } from "@/lib/observability/log-failure";

export default async function ConversationPage({
  params,
}: PageProps<"/[conversationId]">) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { conversationId } = await params;

  if (!isUuid(conversationId)) {
    redirect("/");
  }

  let conversations: ConversationSummary[] = [];
  let conversation;
  let initialMessages: InvoiceAssistantUIMessage[] = [];
  let initialUsage: ConversationUsage = EMPTY_CONVERSATION_USAGE;

  try {
    [conversations, conversation] = await Promise.all([
      listConversations(session.user.id),
      getConversationForUser(conversationId, session.user.id),
    ]);

    if (conversation) {
      [initialMessages, initialUsage] = await Promise.all([
        listConversationMessages(conversationId),
        getConversationUsage(conversationId),
      ]);
    }
  } catch (error) {
    logFailureToLangfuse({
      source: "db",
      error,
      extra: { route: "conversation" },
    });
    throw error;
  }

  return (
    <ChatApp
      key={conversationId}
      user={session.user}
      conversationId={conversationId}
      initialConversations={conversations}
      initialMessages={initialMessages}
      initialUsage={initialUsage}
      showCostBadge={process.env.NODE_ENV !== "production"}
    />
  );
}
