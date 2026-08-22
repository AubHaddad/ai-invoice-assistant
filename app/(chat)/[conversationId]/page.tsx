import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ErrorBoundary } from "@/components/error-boundary";
import {
  getConversationForUser,
  isUuid,
  listConversationMessages,
} from "@/lib/chat/store";
import type { InvoiceAssistantUIMessage } from "@/lib/chat/types";
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

  let initialMessages: InvoiceAssistantUIMessage[] = [];

  try {
    const conversation = await getConversationForUser(
      conversationId,
      session.user.id,
    );

    if (conversation) {
      initialMessages = await listConversationMessages(conversationId);
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
    <ErrorBoundary>
      <ChatPanel
        key={conversationId}
        conversationId={conversationId}
        initialMessages={initialMessages}
      />
    </ErrorBoundary>
  );
}
