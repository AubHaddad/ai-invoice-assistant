"use client";

import Image from "next/image";
import { PinIcon } from "lucide-react";
import { ConversationLink } from "@/components/chat/conversation-link";
import { NewChatButton } from "@/components/chat/new-chat-button";
import { SidebarUser } from "@/components/chat/sidebar-user";
import type { ConversationSummary } from "@/lib/chat/types";

type ChatSidebarProps = {
  conversations: ConversationSummary[];
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  pendingIds: Record<string, true>;
  onPinnedChange: (conversationId: string, pinned: boolean) => void;
};

function conversationLabel(conversation: ConversationSummary) {
  return conversation.title?.trim() || "Untitled";
}

function ConversationItems({
  conversations,
  pendingIds,
  onPinnedChange,
}: {
  conversations: ConversationSummary[];
  pendingIds: Record<string, true>;
  onPinnedChange: (conversationId: string, pinned: boolean) => void;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {conversations.map((conversation) => (
        <li key={conversation.id}>
          <ConversationLink
            conversationId={conversation.id}
            label={conversationLabel(conversation)}
            pinned={conversation.pinned}
            pending={Boolean(pendingIds[conversation.id])}
            onPinnedChange={(pinned) =>
              onPinnedChange(conversation.id, pinned)
            }
          />
        </li>
      ))}
    </ul>
  );
}

export function ChatSidebar({
  conversations,
  user,
  pendingIds,
  onPinnedChange,
}: ChatSidebarProps) {
  const pinned = conversations.filter((conversation) => conversation.pinned);
  const unpinned = conversations.filter((conversation) => !conversation.pinned);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b px-3 py-3">
        <Image
          src="/logo.png"
          alt=""
          width={32}
          height={32}
          className="size-8 rounded-lg"
        />
        <p className="font-heading truncate text-sm font-semibold tracking-tight">
          InvoiceQ
        </p>
      </header>

      <section
        className="shrink-0 border-b px-2 py-3"
        aria-labelledby="pinned-heading"
      >
        <div className="flex items-center gap-1.5 px-2 pb-2">
          <PinIcon className="size-3.5 text-muted-foreground" />
          <h2
            id="pinned-heading"
            className="text-xs font-medium text-muted-foreground"
          >
            Pinned
          </h2>
        </div>
        {pinned.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">
            No pinned chats yet.
          </p>
        ) : (
          <nav
            aria-label="Pinned conversations"
            className="max-h-48 overflow-y-auto"
          >
            <ConversationItems
              conversations={pinned}
              pendingIds={pendingIds}
              onPinnedChange={onPinnedChange}
            />
          </nav>
        )}
      </section>

      <section
        className="flex min-h-0 flex-1 flex-col"
        aria-labelledby="chats-heading"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 px-3 pt-3 pb-2">
          <h2
            id="chats-heading"
            className="text-xs font-medium text-muted-foreground"
          >
            Chats
          </h2>
        </div>
        <div className="shrink-0 px-3 pb-2">
          <NewChatButton
            persistedIds={conversations.map((conversation) => conversation.id)}
          />
        </div>
        <nav
          aria-label="Conversations"
          className="min-h-0 flex-1 overflow-y-auto px-2 pb-3"
        >
          {unpinned.length === 0 ? (
            conversations.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                No conversations yet.
              </p>
            ) : null
          ) : (
            <ConversationItems
              conversations={unpinned}
              pendingIds={pendingIds}
              onPinnedChange={onPinnedChange}
            />
          )}
        </nav>
      </section>

      <footer className="shrink-0 border-t px-3 py-2">
        <SidebarUser user={user} />
      </footer>
    </div>
  );
}
