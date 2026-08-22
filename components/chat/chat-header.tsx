"use client";

import { usePathname } from "next/navigation";
import { ConversationCostBadgeLive } from "@/components/chat/cost-badge";
import { PinConversationButton } from "@/components/chat/pin-conversation-button";
import type { ConversationSummary } from "@/lib/chat/types";

type ChatHeaderProps = {
  conversations: ConversationSummary[];
  showCostBadge?: boolean;
  pendingIds: Record<string, true>;
  onPinnedChange: (conversationId: string, pinned: boolean) => void;
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

export function ChatHeader({
  conversations,
  showCostBadge = false,
  pendingIds,
  onPinnedChange,
}: ChatHeaderProps) {
  const pathname = usePathname();
  const conversationId = pathname.slice(1);
  const conversation = conversations.find((item) => item.id === conversationId);
  const title = conversationTitle(conversations, conversationId);

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
      {showCostBadge ? <ConversationCostBadgeLive /> : null}
    </header>
  );
}
