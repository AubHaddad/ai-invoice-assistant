"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ConversationSummary } from "@/lib/chat/types";

type ChatSidebarProps = {
  conversations: ConversationSummary[];
  activeId: string;
  persistedIds: Set<string>;
  onSelect: (id: string) => void;
  onNewChat: () => void;
};

function conversationLabel(conversation: ConversationSummary) {
  return conversation.title?.trim() || "Untitled";
}

export function ChatSidebar({
  conversations,
  activeId,
  persistedIds,
  onSelect,
  onNewChat,
}: ChatSidebarProps) {
  const isExistingChat = persistedIds.has(activeId);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="p-3">
        <Button
          className="w-full"
          onClick={onNewChat}
          disabled={!isExistingChat}
        >
          <PlusIcon />
          New chat
        </Button>
      </div>
      <nav
        aria-label="Conversations"
        className="min-h-0 flex-1 overflow-y-auto px-2 pb-3"
      >
        {conversations.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            No conversations yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {conversations.map((conversation) => {
              const isActive = conversation.id === activeId;

              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => onSelect(conversation.id)}
                    className={cn(
                      "w-full truncate rounded-xl px-3 py-2 text-left text-sm transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/70",
                    )}
                  >
                    {conversationLabel(conversation)}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </div>
  );
}
