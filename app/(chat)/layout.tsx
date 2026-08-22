import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ChatShell } from "@/components/chat/chat-shell";
import { listConversations } from "@/lib/chat/store";
import type { ConversationSummary } from "@/lib/chat/types";
import { logFailureToLangfuse } from "@/lib/observability/log-failure";

export default async function ChatLayout({
  children,
}: LayoutProps<"/">) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  let conversations: ConversationSummary[] = [];

  try {
    conversations = await listConversations(session.user.id);
  } catch (error) {
    logFailureToLangfuse({
      source: "db",
      error,
      extra: { route: "chat-layout" },
    });
    throw error;
  }

  return (
    <ChatShell
      conversations={conversations}
      user={session.user}
      showCostBadge={process.env.NODE_ENV !== "production"}
    >
      {children}
    </ChatShell>
  );
}
