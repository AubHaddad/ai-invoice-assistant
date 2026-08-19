"use client";

import { formatUsd } from "@/lib/ai/pricing";
import type { ConversationUsage } from "@/lib/chat/types";

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
