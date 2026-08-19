import { Loader2Icon } from "lucide-react";
import { toolStatusFallback } from "@/lib/chat/tool-ui";

export function ToolStatusChip({ toolName }: { toolName: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm text-muted-foreground">
      <Loader2Icon className="size-3.5 animate-spin" />
      {toolStatusFallback(toolName)}
    </div>
  );
}
