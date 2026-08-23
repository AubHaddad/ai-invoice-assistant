"use client";

import { FileTextIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MessageAttachment } from "@/lib/chat/types";
import { formatFileSize } from "@/lib/documents/constants";

export function DocumentPreviewContent({
  attachment,
  onClose,
}: {
  attachment: MessageAttachment;
  onClose: () => void;
}) {
  const fileUrl = `/api/documents/${attachment.documentId}/file`;
  const isImage = attachment.mimeType.startsWith("image/");
  const isPdf = attachment.mimeType === "application/pdf";

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="font-heading truncate text-sm font-medium">
            {attachment.fileName}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatFileSize(attachment.sizeBytes)}
          </p>
        </div>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Close file preview"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      </div>
      <div className="min-h-0 flex-1 bg-muted/30">
        {isImage ? (
          <div className="flex h-full min-h-0 items-start justify-center overflow-auto p-4">
            {/* Authenticated preview from our document file route. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fileUrl}
              alt={attachment.fileName}
              className="max-h-full max-w-full rounded-lg object-contain shadow-sm"
            />
          </div>
        ) : isPdf ? (
          <iframe
            src={fileUrl}
            title={attachment.fileName}
            className="h-full w-full border-0 bg-background"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <FileTextIcon className="size-8" />
            <p>Preview is not available for this file type.</p>
          </div>
        )}
      </div>
    </div>
  );
}
