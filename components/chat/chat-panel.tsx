"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUpIcon, Loader2Icon, SquareIcon } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getMessageText } from "@/lib/chat/message-text";
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

type ChatPanelProps = {
  conversationId: string;
  initialMessages?: UIMessage[];
  onConversationUpdated?: () => void;
};

export function ChatPanel({
  conversationId,
  initialMessages,
  onConversationUpdated,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [transport] = useState(
    () => new DefaultChatTransport({ api: "/api/chat" }),
  );
  const { messages, sendMessage, status, stop, error } = useChat({
    id: conversationId,
    messages: initialMessages,
    generateId: createUuid,
    transport,
    onFinish: () => {
      onConversationUpdated?.();
    },
  });

  const listRef = useRef<HTMLDivElement>(null);
  const isBusy = status === "submitted" || status === "streaming";
  const canSend = status === "ready" && input.trim().length > 0;

  useEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }

    list.scrollTop = list.scrollHeight;
  }, [messages, status]);

  function submit() {
    const text = input.trim();
    if (!text || status !== "ready") {
      return;
    }

    void sendMessage({ text });
    setInput("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    submit();
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
      <div
        ref={listRef}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-6"
      >
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
            const text = getMessageText(message);
            const isUser = message.role === "user";

            return (
              <div
                key={message.id}
                className={cn(
                  "flex w-full",
                  isUser ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-3xl px-4 py-2.5",
                    isUser
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed wrap-break-word">
                      {text}
                    </p>
                  ) : text ? (
                    <AssistantMarkdown text={text} />
                  ) : isBusy ? (
                    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2Icon className="size-4 animate-spin" />
                      Thinking…
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })
        )}

        {status === "submitted" &&
        messages[messages.length - 1]?.role === "user" ? (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-2 rounded-3xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Thinking…
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive">Something went wrong.</p>
        ) : null}
      </div>

      <form
        className="border-t px-4 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="flex items-end gap-2 rounded-4xl border bg-background p-2 shadow-sm">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask about an invoice…"
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
        <p className="mt-2 px-1 text-xs text-muted-foreground">
          Enter to send · Shift+Enter for a new line
        </p>
      </form>
    </div>
  );
}
