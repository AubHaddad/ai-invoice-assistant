import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ChatApp } from "@/components/chat/chat-app";
import {
  getConversationForUser,
  isUuid,
  listConversationMessages,
  listConversations,
} from "@/lib/chat/store";

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

  const [conversations, conversation] = await Promise.all([
    listConversations(session.user.id),
    getConversationForUser(conversationId, session.user.id),
  ]);
  const initialMessages = conversation
    ? await listConversationMessages(conversationId)
    : [];

  return (
    <ChatApp
      key={conversationId}
      user={session.user}
      conversationId={conversationId}
      initialConversations={conversations}
      initialMessages={initialMessages}
    />
  );
}
