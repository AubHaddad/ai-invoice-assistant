"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatUsd } from "@/lib/ai/pricing";
import {
  EMPTY_CONVERSATION_USAGE,
  type ConversationUsage,
} from "@/lib/chat/types";

export const CONVERSATION_UPDATED_EVENT =
  "invoice-assistant:conversation-updated";

export function notifyConversationUpdated() {
  window.dispatchEvent(new Event(CONVERSATION_UPDATED_EVENT));
}

export function ConversationCostBadge({ usage }: { usage: ConversationUsage }) {
  return (
    <span
      className="shrink-0 rounded-full border bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
      aria-label="Cost per conversation"
      title={`Cost per conversation · ${usage.tokensIn} in / ${usage.tokensOut} out / ${usage.tokensCached} cached`}
    >
      cost {formatUsd(usage.costUsd)}
    </span>
  );
}

async function fetchConversationUsage(conversationId: string) {
  const response = await fetch(`/api/conversations/${conversationId}/usage`);

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { usage: ConversationUsage };
  return data.usage;
}

export function ConversationCostBadgeLive() {
  const pathname = usePathname();
  const conversationId = pathname.slice(1);
  const [usage, setUsage] = useState<ConversationUsage>(
    EMPTY_CONVERSATION_USAGE,
  );

  const refreshUsage = useCallback(async () => {
    if (!conversationId) {
      return;
    }

    const nextUsage = await fetchConversationUsage(conversationId);

    if (nextUsage) {
      setUsage(nextUsage);
    }
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    let cancelled = false;

    void fetchConversationUsage(conversationId).then((nextUsage) => {
      if (!cancelled && nextUsage) {
        setUsage(nextUsage);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    function onConversationUpdated() {
      void refreshUsage();
    }

    window.addEventListener(CONVERSATION_UPDATED_EVENT, onConversationUpdated);
    return () => {
      window.removeEventListener(
        CONVERSATION_UPDATED_EVENT,
        onConversationUpdated,
      );
    };
  }, [refreshUsage]);

  return (
    <ConversationCostBadge
      usage={conversationId ? usage : EMPTY_CONVERSATION_USAGE}
    />
  );
}
