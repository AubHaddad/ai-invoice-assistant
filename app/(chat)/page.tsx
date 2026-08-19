import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ChatApp } from "@/components/chat/chat-app";
import { listConversations } from "@/lib/chat/store";

export default async function ChatPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const conversations = await listConversations(session.user.id);

  return (
    <ChatApp user={session.user} initialConversations={conversations} />
  );
}
