"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

type NewChatButtonProps = {
  persistedIds: string[];
};

export function NewChatButton({ persistedIds }: NewChatButtonProps) {
  const pathname = usePathname();
  const activeId = pathname.slice(1);
  const href = pathname === "/chats" || persistedIds.includes(activeId) ? `/${crypto.randomUUID()}` : pathname;

  return (
    <Link href={href} className="w-full hover:bg-muted flex gap-2 items-center cursor-pointer p-2 rounded-md  text-sm font-medium whitespace-nowrap">
      <PlusIcon className="size-5" />
      New chat
    </Link>
  );
}
