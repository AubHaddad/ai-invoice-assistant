import { FileTextIcon, ImageIcon } from "lucide-react";
import { formatFileSize } from "@/lib/documents/constants";
import type { MessageAttachment } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

export function MessageAttachments({
  attachments,
  selectedDocumentId,
  onSelect,
}: {
  attachments: MessageAttachment[];
  selectedDocumentId?: string;
  onSelect: (attachment: MessageAttachment) => void;
}) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <ul className="flex max-w-[85%] flex-col items-end gap-1.5">
      {attachments.map((file) => {
        const selected = file.documentId === selectedDocumentId;

        return (
          <li key={file.documentId} data-testid="message-attachment">
            <button
              type="button"
              onClick={() => onSelect(file)}
              aria-label={`View ${file.fileName}`}
              aria-pressed={selected}
              className={cn(
                "flex max-w-full items-center gap-2 rounded-2xl border bg-background px-2.5 py-1.5 text-left text-foreground shadow-sm",
                "hover:bg-muted",
                selected && "border-primary ring-2 ring-primary/20",
              )}
            >
              {file.mimeType.startsWith("image/") ? (
                <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 truncate text-sm font-medium">
                {file.fileName}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatFileSize(file.sizeBytes)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
