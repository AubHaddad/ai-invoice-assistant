"use client";

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ConversationSummary } from "@/lib/chat/types";

type ConversationsContextValue = {
  conversations: ConversationSummary[];
  pendingIds: Record<string, true>;
  onPinnedChange: (conversationId: string, pinned: boolean) => Promise<void>;
  onRename: (conversationId: string, title: string) => Promise<boolean>;
  onDelete: (conversationId: string) => Promise<boolean>;
};

const ConversationsContext = createContext<ConversationsContextValue | null>(
  null,
);

async function patchConversation(
  conversationId: string,
  body: { pinned?: boolean; title?: string },
) {
  const response = await fetch(`/api/conversations/${conversationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error("Failed to update conversation");
  }
}

async function deleteConversationRequest(conversationId: string) {
  const response = await fetch(`/api/conversations/${conversationId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete conversation");
  }
}

export function ConversationsProvider({
  conversations,
  children,
}: {
  conversations: ConversationSummary[];
  children: ReactNode;
}) {
  const [pinOverrides, setPinOverrides] = useState<Record<string, boolean>>(
    {},
  );
  const [titleOverrides, setTitleOverrides] = useState<Record<string, string>>(
    {},
  );
  const [deletedIds, setDeletedIds] = useState<Record<string, true>>({});
  const [pendingIds, setPendingIds] = useState<Record<string, true>>({});
  const pendingIdsRef = useRef<Record<string, true>>({});

  const items = useMemo(
    () =>
      conversations
        .filter((conversation) => !deletedIds[conversation.id])
        .map((conversation) => ({
          ...conversation,
          pinned: pinOverrides[conversation.id] ?? conversation.pinned,
          title:
            titleOverrides[conversation.id] !== undefined
              ? titleOverrides[conversation.id]
              : conversation.title,
        })),
    [conversations, deletedIds, pinOverrides, titleOverrides],
  );

  function beginPending(conversationId: string) {
    if (pendingIdsRef.current[conversationId]) {
      return false;
    }

    pendingIdsRef.current = {
      ...pendingIdsRef.current,
      [conversationId]: true,
    };
    setPendingIds(pendingIdsRef.current);
    return true;
  }

  function endPending(conversationId: string) {
    const next = { ...pendingIdsRef.current };
    delete next[conversationId];
    pendingIdsRef.current = next;
    setPendingIds(next);
  }

  async function onPinnedChange(conversationId: string, pinned: boolean) {
    if (!beginPending(conversationId)) {
      return;
    }

    setPinOverrides((current) => ({ ...current, [conversationId]: pinned }));

    try {
      await patchConversation(conversationId, { pinned });
    } catch {
      setPinOverrides((current) => {
        const next = { ...current };
        delete next[conversationId];
        return next;
      });
    } finally {
      endPending(conversationId);
    }
  }

  async function onRename(conversationId: string, title: string) {
    const nextTitle = title.trim();

    if (!nextTitle || !beginPending(conversationId)) {
      return false;
    }

    setTitleOverrides((current) => ({ ...current, [conversationId]: nextTitle }));

    try {
      await patchConversation(conversationId, { title: nextTitle });
      return true;
    } catch {
      setTitleOverrides((current) => {
        const next = { ...current };
        delete next[conversationId];
        return next;
      });
      return false;
    } finally {
      endPending(conversationId);
    }
  }

  async function onDelete(conversationId: string) {
    if (!beginPending(conversationId)) {
      return false;
    }

    setDeletedIds((current) => ({ ...current, [conversationId]: true }));

    try {
      await deleteConversationRequest(conversationId);
      return true;
    } catch {
      setDeletedIds((current) => {
        const next = { ...current };
        delete next[conversationId];
        return next;
      });
      return false;
    } finally {
      endPending(conversationId);
    }
  }

  const value = {
    conversations: items,
    pendingIds,
    onPinnedChange,
    onRename,
    onDelete,
  };

  return (
    <ConversationsContext.Provider value={value}>
      {children}
    </ConversationsContext.Provider>
  );
}

export function useConversations() {
  const value = useContext(ConversationsContext);

  if (!value) {
    throw new Error("useConversations must be used within ConversationsProvider");
  }

  return value;
}
