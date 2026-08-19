"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { UserMenu } from "@/components/auth/user-menu";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ConversationCostBadge } from "@/components/chat/cost-badge";
import { ErrorBoundary } from "@/components/error-boundary";
import type { InvoiceAssistantUIMessage } from "@/lib/chat/types";
import {
  EMPTY_CONVERSATION_USAGE,
  type ConversationSummary,
  type ConversationUsage,
} from "@/lib/chat/types";

type ChatAppProps = {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  conversationId: string;
  initialConversations: ConversationSummary[];
  initialMessages: InvoiceAssistantUIMessage[];
  initialUsage?: ConversationUsage;
  showCostBadge?: boolean;
};

export function ChatApp({
  user,
  conversationId,
  initialConversations,
  initialMessages,
  initialUsage,
  showCostBadge = false,
}: ChatAppProps) {
  const router = useRouter();
  const [conversations, setConversations] =
    useState<ConversationSummary[]>(initialConversations);
  const [usage, setUsage] = useState<ConversationUsage>(
    initialUsage ?? EMPTY_CONVERSATION_USAGE,
  );

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

  async function refreshUsage() {
    if (!showCostBadge) {
      return;
    }

    const response = await fetch(`/api/conversations/${conversationId}/usage`);

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { usage: ConversationUsage };
    setUsage(data.usage);
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
          <div className="flex min-w-0 items-center gap-2">
            <p className="font-heading truncate text-sm font-medium">
              Invoice Assistant
            </p>
            {showCostBadge ? (
              <ConversationCostBadge usage={usage} />
            ) : null}
          </div>
          <UserMenu user={user} />
        </header>

        <ErrorBoundary>
          <ChatPanel
            conversationId={conversationId}
            initialMessages={initialMessages}
            onConversationUpdated={() => {
              void refreshConversations();
              void refreshUsage();
            }}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}
