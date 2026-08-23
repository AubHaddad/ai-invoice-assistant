"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  ArrowUpIcon,
  Loader2Icon,
  PaperclipIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ComposerUploads } from "@/components/chat/composer-uploads";
import { DocumentPreviewPanel } from "@/components/chat/document-preview-panel";
import { MessageAttachments } from "@/components/chat/message-attachments";
import { useComposerUploads } from "@/components/chat/use-composer-uploads";
import { notifyConversationUpdated } from "@/components/chat/cost-badge";
import { InvoiceReviewCard } from "@/components/chat/invoice-review-card";
import {
  ToolPart,
  isRenderableToolPart,
  type ExtractInvoiceToolPart,
} from "@/components/chat/tool-part";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  InvoiceAssistantUIMessage,
  MessageAttachment,
} from "@/lib/chat/types";
import { getChatErrorBannerMessage } from "@/lib/chat/error-message";
import {
  DEFAULT_UPLOAD_USER_TEXT,
  getMessageAttachments,
  getMessageText,
} from "@/lib/chat/message-text";
import {
  ExtractInvoiceResultSchema,
  invoiceSavedSystemText,
  type SavedInvoice,
} from "@/lib/invoices/types";
import { cn } from "@/lib/utils";

function AssistantMarkdown({ text }: { text: string }) {
  return (
    <div
      className={cn(
        "text-sm leading-relaxed wrap-break-word",
        "[&_p]:mb-2 [&_p:last-child]:mb-0",
        "[&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:my-0.5",
        "[&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold",
        "[&_h2]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold",
        "[&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-medium",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
        "[&_hr]:my-3 [&_hr]:border-border",
        "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm",
        "[&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
        "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1",
        "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-muted [&_pre]:p-3",
        "[&_code]:font-mono [&_code]:text-[0.85em]",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_:not(pre)>code]:rounded-md [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5",
        "[&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2",
      )}
    >
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}

function createUuid() {
  return crypto.randomUUID();
}

function latestSuccessfulExtract(messages: InvoiceAssistantUIMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    for (
      let partIndex = message.parts.length - 1;
      partIndex >= 0;
      partIndex -= 1
    ) {
      const part = message.parts[partIndex];

      if (
        part.type !== "tool-extractInvoice" ||
        part.state !== "output-available"
      ) {
        continue;
      }

      const parsed = ExtractInvoiceResultSchema.safeParse(part.output);

      if (parsed.success && parsed.data.ok) {
        return part;
      }
    }
  }

  return null;
}

type ChatPanelProps = {
  conversationId: string;
  initialMessages?: InvoiceAssistantUIMessage[];
};

export function ChatPanel({ conversationId, initialMessages }: ChatPanelProps) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ id, messages, body }) => ({
          body: {
            ...body,
            id,
            messages,
          },
        }),
      }),
  );
  const { messages, sendMessage, status, stop, error, clearError } =
    useChat<InvoiceAssistantUIMessage>({
      id: conversationId,
      messages: initialMessages,
      generateId: createUuid,
      transport,
      onFinish: () => {
        router.refresh();
        notifyConversationUpdated();
      },
    });

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewPart, setReviewPart] = useState<ExtractInvoiceToolPart | null>(
    null,
  );
  const [previewAttachment, setPreviewAttachment] =
    useState<MessageAttachment | null>(null);
  const autoOpenedToolCallIdRef = useRef<string | null>(null);
  const sidePanelOpen = reviewOpen || previewAttachment !== null;

  function openReview(part: ExtractInvoiceToolPart) {
    setPreviewAttachment(null);
    setReviewPart(part);
    setReviewOpen(true);
  }

  function closeReview() {
    setReviewOpen(false);
  }

  function openPreview(attachment: MessageAttachment) {
    setReviewOpen(false);
    setPreviewAttachment(attachment);
  }

  function closePreview() {
    setPreviewAttachment(null);
  }

  function onInvoiceSaved(saved: SavedInvoice) {
    clearError();
    void sendMessage({
      role: "system",
      parts: [{ type: "text", text: invoiceSavedSystemText(saved) }],
    });
  }

  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const {
    items: uploads,
    isUploading,
    uploadedDocumentIds,
    uploadFiles,
    removeItem,
    clearUploaded,
    accept,
  } = useComposerUploads(conversationId);
  const isBusy = status === "submitted" || status === "streaming";
  const hasUploaded = uploadedDocumentIds.length > 0;
  const canSend =
    status === "ready" &&
    !isUploading &&
    (input.trim().length > 0 || hasUploaded);

  useEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }

    list.scrollTop = list.scrollHeight;
  }, [messages, status]);

  useEffect(() => {
    const latest = latestSuccessfulExtract(messages);

    if (!latest || latest.toolCallId === autoOpenedToolCallIdRef.current) {
      return;
    }

    autoOpenedToolCallIdRef.current = latest.toolCallId;
    openReview(latest);
  }, [messages]);

  function submit() {
    const typed = input.trim();
    const uploadedFiles = uploads.filter(
      (
        item,
      ): item is (typeof uploads)[number] & {
        documentId: string;
      } => item.status === "uploaded" && Boolean(item.documentId),
    );
    const text = typed || (uploadedFiles.length > 0 ? DEFAULT_UPLOAD_USER_TEXT : "");

    if (!text || status !== "ready") {
      return;
    }

    void sendMessage(
      {
        parts: [
          { type: "text", text },
          ...uploadedFiles.map((file) => ({
            type: "data-attachment" as const,
            data: {
              documentId: file.documentId,
              fileName: file.fileName,
              mimeType: file.mimeType,
              sizeBytes: file.sizeBytes,
            },
          })),
        ],
      },
      { body: { documentIds: uploadedFiles.map((file) => file.documentId) } },
    );
    setInput("");
    clearUploaded();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    event.preventDefault();
    submit();
  }

  function onFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files && event.target.files.length > 0) {
      uploadFiles(event.target.files);
    }

    event.target.value = "";
  }

  function onDragOver(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  }

  function onDragLeave(event: DragEvent<HTMLFormElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setIsDragging(false);
  }

  function onDrop(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (event.dataTransfer.files.length > 0) {
      uploadFiles(event.dataTransfer.files);
    }
  }

  const reviewResult =
    reviewPart?.state === "output-available"
      ? ExtractInvoiceResultSchema.safeParse(reviewPart.output)
      : null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div
        className={cn(
          "min-h-0 w-full flex-1 flex-col",
          sidePanelOpen ? "hidden md:flex" : "flex",
        )}
      >
        {error ? (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 border-b bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <p>{getChatErrorBannerMessage(error)}</p>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Dismiss error"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => clearError()}
            >
              <XIcon />
            </Button>
          </div>
        ) : null}
        <div
          ref={listRef}
          className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-4 py-6"
        >
          <div className="flex flex-1 flex-col gap-4 max-w-5xl">
            {messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <h1 className="font-heading text-2xl font-medium tracking-tight">
                  Chat
                </h1>
                <p className="mt-2 max-w-md text-muted-foreground">
                  Upload an invoice and ask a question to get started.
                </p>
              </div>
            ) : (
              messages.map((message) => {
                if (message.role === "system") {
                  return null;
                }

                const isUser = message.role === "user";

                if (isUser) {
                  const attachments = getMessageAttachments(message);
                  const text = getMessageText(message);

                  return (
                    <div
                      key={message.id}
                      className="flex w-full flex-col items-end gap-2"
                    >
                      <MessageAttachments
                        attachments={attachments}
                        selectedDocumentId={previewAttachment?.documentId}
                        onSelect={openPreview}
                      />
                      {text ? (
                        <div className="max-w-[85%] rounded-3xl bg-primary px-4 py-2.5 text-primary-foreground">
                          <p className="whitespace-pre-wrap text-sm leading-relaxed wrap-break-word">
                            {text}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  );
                }

                const hasContent = message.parts.some(
                  (part) =>
                    (part.type === "text" && part.text) ||
                    isRenderableToolPart(part),
                );

                return (
                  <div
                    key={message.id}
                    className="flex w-full flex-col items-start gap-3"
                  >
                    {message.parts.map((part, index) => {
                      if (part.type === "text" && part.text) {
                        return (
                          <div
                            key={`${message.id}-text-${index}`}
                            className="max-w-[85%] rounded-3xl bg-muted px-4 py-2.5 text-foreground"
                          >
                            <AssistantMarkdown text={part.text} />
                          </div>
                        );
                      }

                      if (isRenderableToolPart(part)) {
                        return (
                          <div
                            key={part.toolCallId}
                            className="w-full max-w-xl"
                          >
                            <ToolPart
                              part={part}
                              isReviewing={
                                reviewOpen &&
                                reviewPart?.toolCallId === part.toolCallId
                              }
                              onReview={openReview}
                            />
                          </div>
                        );
                      }

                      return null;
                    })}
                    {!hasContent && isBusy ? (
                      <div className="inline-flex items-center gap-2 rounded-3xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                        <Loader2Icon className="size-4 animate-spin" />
                        Thinking…
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}

            {status === "submitted" &&
            messages[messages.length - 1]?.role !== "assistant" ? (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-3xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" />
                  Thinking…
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <form
          className="border-t px-4 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            multiple
            className="sr-only"
            aria-label="Upload invoice"
            onChange={onFilesSelected}
          />
          <div
            className={cn(
              "relative rounded-4xl border bg-background p-2 shadow-sm transition-colors",
              isDragging && "border-primary bg-primary/5",
            )}
          >
            {isDragging ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-4xl bg-background/80 text-sm font-medium">
                Drop invoice to upload
              </div>
            ) : null}
            <ComposerUploads items={uploads} onRemove={removeItem} />
            <div className="flex items-end gap-2">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Attach invoice"
                disabled={isBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                <PaperclipIcon />
              </Button>
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask about an invoice… or drop a file"
                rows={1}
                aria-label="Chat message"
                className="min-h-10 max-h-36 flex-1 border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0"
              />
              {isBusy ? (
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  aria-label="Stop generating"
                  onClick={() => stop()}
                >
                  <SquareIcon className="size-3.5 fill-current" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  aria-label="Send message"
                  disabled={!canSend}
                >
                  <ArrowUpIcon />
                </Button>
              )}
            </div>
          </div>
          <p className="mt-2 px-1 text-xs text-muted-foreground">
            Enter to send · Shift+Enter for a new line · PDF or image
          </p>
        </form>
      </div>

      {previewAttachment ? (
        <DocumentPreviewPanel
          attachment={previewAttachment}
          onClose={closePreview}
        />
      ) : reviewOpen && reviewPart && reviewResult?.success ? (
        <aside className="flex min-h-0 w-full shrink-0 flex-col border-l bg-background md:w-md">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <p className="font-heading text-sm font-medium">Invoice review</p>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Close invoice review"
              onClick={closeReview}
            >
              <XIcon />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <InvoiceReviewCard
              key={reviewPart.toolCallId}
              result={reviewResult.data}
              conversationId={conversationId}
              onSaved={onInvoiceSaved}
              onDiscard={closeReview}
            />
          </div>
        </aside>
      ) : null}
    </div>
  );
}
