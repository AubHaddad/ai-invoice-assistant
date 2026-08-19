import { Loader2Icon } from "lucide-react";

export default function ConversationLoading() {
  return (
    <div className="flex flex-1 items-center justify-center text-muted-foreground">
      <Loader2Icon className="size-5 animate-spin" />
      <span className="sr-only">Loading conversation</span>
    </div>
  );
}
