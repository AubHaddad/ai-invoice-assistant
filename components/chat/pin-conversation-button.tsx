"use client";

import { PinIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PinConversationButtonProps = {
  pinned: boolean;
  pending?: boolean;
  className?: string;
  onPinnedChange: (pinned: boolean) => void;
};

export function PinConversationButton({
  pinned,
  pending = false,
  className,
  onPinnedChange,
}: PinConversationButtonProps) {
  const label = pinned ? "Unpin conversation" : "Pin conversation";

  function toggle() {
    if (pending) {
      return;
    }

    onPinnedChange(!pinned);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      aria-pressed={pinned}
      aria-busy={pending}
      title={label}
      className={cn(
        "relative z-10 shrink-0",
        pinned && "text-foreground",
        pending && "opacity-50",
        className,
      )}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        toggle();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();

        if (event.detail !== 0) {
          return;
        }

        toggle();
      }}
    >
      <PinIcon className={cn(pinned && "fill-current")} />
    </Button>
  );
}
