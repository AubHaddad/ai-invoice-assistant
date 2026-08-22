"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PinConversationButton } from "@/components/chat/pin-conversation-button";
import { cn } from "@/lib/utils";

type ConversationLinkProps = {
  conversationId: string;
  label: string;
  pinned: boolean;
  pending?: boolean;
  onPinnedChange: (pinned: boolean) => void;
};

export function ConversationLink({
  conversationId,
  label,
  pinned,
  pending = false,
  onPinnedChange,
}: ConversationLinkProps) {
  const pathname = usePathname();
  const isActive = pathname.slice(1) === conversationId;

  return (
    <div
      className={cn(
        "group/conversation flex items-center rounded-xl transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/70",
      )}
    >
      <Link
        href={`/${conversationId}`}
        aria-current={isActive ? "page" : undefined}
        className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm"
      >
        {label}
      </Link>
      <PinConversationButton
        pinned={pinned}
        pending={pending}
        onPinnedChange={onPinnedChange}
        className={cn(
          "mr-1",
          pinned
            ? "opacity-100"
            : "opacity-40 group-hover/conversation:opacity-100 group-focus-within/conversation:opacity-100",
        )}
      />
    </div>
  );
}
