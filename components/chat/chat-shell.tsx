"use client";

import type { ReactNode } from "react";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ConversationsProvider } from "@/components/chat/conversations-context";
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

export function ChatShell({
  conversations,
  user,
  showCostBadge = false,
  children,
}: ChatShellProps) {
  return (
    <ConversationsProvider conversations={conversations}>
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-56 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground sm:w-64">
          <ChatSidebar user={user} />
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ChatHeader showCostBadge={showCostBadge} />
          {children}
        </div>
      </div>
    </ConversationsProvider>
  );
}
