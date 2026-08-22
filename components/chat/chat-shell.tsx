"use client";

import { useRef, useState, type ReactNode } from "react";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import type { ConversationSummary } from "@/lib/chat/types";

type ChatShellProps = {
  conversations: ConversationSummary[];
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  showCostBadge?: boolean;
  children: ReactNode;
};

async function savePinned(conversationId: string, pinned: boolean) {
  const response = await fetch(`/api/conversations/${conversationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pinned }),
  });

  if (!response.ok) {
    throw new Error("Failed to update pin");
  }
}

export function ChatShell({
  conversations,
  user,
  showCostBadge = false,
  children,
}: ChatShellProps) {
  const [pinOverrides, setPinOverrides] = useState<Record<string, boolean>>(
    {},
  );
  const [pendingIds, setPendingIds] = useState<Record<string, true>>({});
  const pendingIdsRef = useRef<Record<string, true>>({});

  const items = conversations.map((conversation) => {
    const pinned = pinOverrides[conversation.id];
    return pinned === undefined ? conversation : { ...conversation, pinned };
  });

  async function onPinnedChange(conversationId: string, pinned: boolean) {
    if (pendingIdsRef.current[conversationId]) {
      return;
    }

    pendingIdsRef.current = { ...pendingIdsRef.current, [conversationId]: true };
    setPendingIds(pendingIdsRef.current);
    setPinOverrides((current) => ({ ...current, [conversationId]: pinned }));

    try {
      await savePinned(conversationId, pinned);
    } catch {
      setPinOverrides((current) => {
        const next = { ...current };
        delete next[conversationId];
        return next;
      });
    } finally {
      const next = { ...pendingIdsRef.current };
      delete next[conversationId];
      pendingIdsRef.current = next;
      setPendingIds(next);
    }
  }

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground sm:w-64">
        <ChatSidebar
          conversations={items}
          user={user}
          pendingIds={pendingIds}
          onPinnedChange={onPinnedChange}
        />
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ChatHeader
          conversations={items}
          showCostBadge={showCostBadge}
          pendingIds={pendingIds}
          onPinnedChange={onPinnedChange}
        />
        {children}
      </div>
    </div>
  );
}
