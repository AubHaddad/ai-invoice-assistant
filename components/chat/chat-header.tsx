"use client";

import { usePathname } from "next/navigation";
import { ConversationCostBadgeLive } from "@/components/chat/cost-badge";
import { useConversations } from "@/components/chat/conversations-context";
import { PinConversationButton } from "@/components/chat/pin-conversation-button";
import type { ConversationSummary } from "@/lib/chat/types";

type ChatHeaderProps = {
  showCostBadge?: boolean;
};

function conversationTitle(
  conversations: ConversationSummary[],
  conversationId: string,
) {
  const conversation = conversations.find((item) => item.id === conversationId);

  if (!conversation) {
    return "New chat";
  }

  return conversation.title?.trim() || "Untitled";
}

export function ChatHeader({ showCostBadge = false }: ChatHeaderProps) {
  const pathname = usePathname();
  const { conversations, pendingIds, onPinnedChange } = useConversations();
  const isAllChats = pathname === "/chats";
  const conversationId = pathname.slice(1);
  const conversation = isAllChats
    ? undefined
    : conversations.find((item) => item.id === conversationId);
  const title = isAllChats
    ? "All chats"
    : conversationTitle(conversations, conversationId);

  return (
    <header className="flex items-center justify-between gap-4 border-b px-3 py-3 md:px-4">
      <div className="flex min-w-0 items-center gap-1">
        <h1 className="font-heading min-w-0 truncate text-sm font-medium">
          {title}
        </h1>
        {conversation ? (
          <PinConversationButton
            pinned={conversation.pinned}
            pending={Boolean(pendingIds[conversation.id])}
            onPinnedChange={(pinned) =>
              onPinnedChange(conversation.id, pinned)
            }
          />
        ) : null}
      </div>
      {showCostBadge && !isAllChats ? <ConversationCostBadgeLive /> : null}
    </header>
  );
}
