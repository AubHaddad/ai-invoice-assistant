"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { UserMenu } from "@/components/auth/user-menu";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ErrorBoundary } from "@/components/error-boundary";
import type { InvoiceAssistantUIMessage } from "@/lib/chat/types";
import type { ConversationSummary } from "@/lib/chat/types";

type ChatAppProps = {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  conversationId: string;
  initialConversations: ConversationSummary[];
  initialMessages: InvoiceAssistantUIMessage[];
};

export function ChatApp({
  user,
  conversationId,
  initialConversations,
  initialMessages,
}: ChatAppProps) {
  const router = useRouter();
  const [conversations, setConversations] =
    useState<ConversationSummary[]>(initialConversations);

  const persistedIds = useMemo(
    () => new Set(conversations.map((conversation) => conversation.id)),
    [conversations],
  );

  async function refreshConversations() {
    const response = await fetch("/api/conversations");

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as {
      conversations: ConversationSummary[];
    };
    setConversations(data.conversations);
  }

  function startNewChat() {
    router.push(`/${crypto.randomUUID()}`);
  }

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground sm:w-64">
        <ChatSidebar
          conversations={conversations}
          activeId={conversationId}
          persistedIds={persistedIds}
          onNewChat={startNewChat}
        />
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b px-3 py-3 md:px-4">
          <p className="font-heading truncate text-sm font-medium">
            Invoice Assistant
          </p>
          <UserMenu user={user} />
        </header>

        <ErrorBoundary>
          <ChatPanel
            conversationId={conversationId}
            initialMessages={initialMessages}
            onConversationUpdated={() => {
              void refreshConversations();
            }}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}
