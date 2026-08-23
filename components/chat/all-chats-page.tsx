"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { useConversations } from "@/components/chat/conversations-context";
import { PinConversationButton } from "@/components/chat/pin-conversation-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ConversationSummary } from "@/lib/chat/types";

function conversationLabel(conversation: ConversationSummary) {
  return conversation.title?.trim() || "Untitled";
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function dateGroupTitle(updatedAt: string, now = new Date()) {
  const date = new Date(updatedAt);
  const day = startOfLocalDay(date);
  const today = startOfLocalDay(now);
  const yesterdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.getTime();

  if (day === today) {
    return "Today";
  }

  if (day === yesterday) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  }).format(date);
}

function groupConversationsByDate(conversations: ConversationSummary[]) {
  const sorted = [...conversations].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
  const groups: { title: string; conversations: ConversationSummary[] }[] = [];

  for (const conversation of sorted) {
    const title = dateGroupTitle(conversation.updatedAt);
    const current = groups.at(-1);

    if (current?.title === title) {
      current.conversations.push(conversation);
    } else {
      groups.push({ title, conversations: [conversation] });
    }
  }

  return groups;
}

function ConversationGroup({
  title,
  conversations,
  onRename,
  onDelete,
}: {
  title: string;
  conversations: ConversationSummary[];
  onRename: (conversation: ConversationSummary) => void;
  onDelete: (conversation: ConversationSummary) => void;
}) {
  const { pendingIds, onPinnedChange } = useConversations();

  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-xs font-medium text-muted-foreground">{title}</h2>
      <ul className="flex flex-col gap-0.5">
        {conversations.map((conversation) => {
          const pending = Boolean(pendingIds[conversation.id]);
          const label = conversationLabel(conversation);

          return (
            <li
              key={conversation.id}
              className="flex items-center gap-1 rounded-xl hover:bg-muted/70"
            >
              <Link
                href={`/${conversation.id}`}
                className="min-w-0 flex-1 truncate px-3 py-2 text-sm"
              >
                {label}
              </Link>
              <PinConversationButton
                pinned={conversation.pinned}
                pending={pending}
                onPinnedChange={(pinned) =>
                  onPinnedChange(conversation.id, pinned)
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Rename ${label}`}
                disabled={pending}
                onClick={() => onRename(conversation)}
              >
                <PencilIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Delete ${label}`}
                disabled={pending}
                className="mr-1 text-destructive hover:text-destructive"
                onClick={() => onDelete(conversation)}
              >
                <Trash2Icon />
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function AllChatsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { conversations, onRename, onDelete } = useConversations();
  const [renameTarget, setRenameTarget] = useState<ConversationSummary | null>(
    null,
  );
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ConversationSummary | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const groups = groupConversationsByDate(conversations);

  async function handleRename(event: FormEvent) {
    event.preventDefault();

    if (!renameTarget) {
      return;
    }

    setSaving(true);
    const ok = await onRename(renameTarget.id, renameValue);
    setSaving(false);

    if (ok) {
      setRenameTarget(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    setSaving(true);
    const ok = await onDelete(deleteTarget.id);
    setSaving(false);

    if (!ok) {
      return;
    }

    setDeleteTarget(null);

    if (pathname.slice(1) === deleteTarget.id) {
      router.push("/");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 md:px-6">
      {conversations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No conversations yet.</p>
      ) : (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
          {groups.map((group) => (
            <ConversationGroup
              key={group.title}
              title={group.title}
              conversations={group.conversations}
              onRename={(conversation) => {
                setRenameValue(conversation.title?.trim() || "");
                setRenameTarget(conversation);
              }}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setRenameTarget(null);
          }
        }}
      >
        <DialogContent>
          <form onSubmit={handleRename} className="grid gap-6">
            <DialogHeader>
              <DialogTitle>Rename chat</DialogTitle>
              <DialogDescription>
                Choose a short name for this conversation.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              maxLength={100}
              aria-label="Conversation title"
              autoFocus
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setRenameTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || renameValue.trim().length === 0}
              >
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete chat</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Delete “${conversationLabel(deleteTarget)}”? This cannot be undone.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={saving}
              onClick={() => {
                void handleDelete();
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
