"use client";

import type { UIMessage } from "ai";
import { Loader2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { UserMenu } from "@/components/auth/user-menu";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import type { ConversationSummary } from "@/lib/chat/types";

type ChatAppProps = {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  initialConversations: ConversationSummary[];
};

function createChatId() {
  return crypto.randomUUID();
}

export function ChatApp({ user, initialConversations }: ChatAppProps) {
  const [conversations, setConversations] =
    useState<ConversationSummary[]>(initialConversations);
  const [activeId, setActiveId] = useState(createChatId);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

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
    setActiveId(createChatId());
    setInitialMessages([]);
  }

  async function selectConversation(id: string) {
    if (id === activeId) {
      return;
    }

    setIsLoadingHistory(true);

    try {
      const response = await fetch(`/api/conversations/${id}`);

      if (!response.ok) {
        throw new Error("Failed to load conversation");
      }

      const data = (await response.json()) as { messages: UIMessage[] };
      setActiveId(id);
      setInitialMessages(data.messages);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingHistory(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground sm:w-64">
        <ChatSidebar
          conversations={conversations}
          activeId={activeId}
          persistedIds={persistedIds}
          onSelect={(id) => {
            void selectConversation(id);
          }}
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

        {isLoadingHistory ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" />
            <span className="sr-only">Loading conversation</span>
          </div>
        ) : (
          <ChatPanel
            key={activeId}
            conversationId={activeId}
            initialMessages={initialMessages}
            onConversationUpdated={() => {
              void refreshConversations();
            }}
          />
        )}
      </div>
    </div>
  );
}
