"use client";

import { FileTextIcon, ImageIcon, Loader2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/documents/constants";
import { cn } from "@/lib/utils";

export type ComposerUploadItem = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  progress: number;
  status: "signing" | "uploading" | "confirming" | "uploaded" | "error";
  error?: string;
  documentId?: string;
};

function isImage(mimeType: string) {
  return mimeType.startsWith("image/");
}

function statusLabel(item: ComposerUploadItem) {
  if (item.status === "error") {
    return item.error ?? "Upload failed";
  }

  if (item.status === "uploaded") {
    return "Uploaded";
  }

  if (item.status === "confirming") {
    return "Confirming…";
  }

  if (item.status === "signing") {
    return "Preparing…";
  }

  return `${item.progress}%`;
}

export function ComposerUploads({
  items,
  onRemove,
}: {
  items: ComposerUploadItem[];
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-2 px-1 pb-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-2xl border bg-muted/40 px-3 py-2"
        >
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-muted-foreground">
              {isImage(item.mimeType) ? (
                <ImageIcon className="size-4" />
              ) : (
                <FileTextIcon className="size-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium">{item.fileName}</p>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatFileSize(item.sizeBytes)}
                </span>
              </div>
              <p
                className={cn(
                  "mt-0.5 text-xs",
                  item.status === "error"
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {statusLabel(item)}
              </p>
              {item.status !== "uploaded" && item.status !== "error" ? (
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={item.progress}
                  aria-label={`Uploading ${item.fileName}`}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-150"
                    style={{
                      width: `${item.status === "signing" ? 8 : item.progress}%`,
                    }}
                  />
                </div>
              ) : null}
            </div>
            {item.status === "signing" ||
            item.status === "uploading" ||
            item.status === "confirming" ? (
              <Loader2Icon className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={`Remove ${item.fileName}`}
                onClick={() => onRemove(item.id)}
              >
                <XIcon />
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
