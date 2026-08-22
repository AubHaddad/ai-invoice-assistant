"use client";

import { usePathname, useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type NewChatButtonProps = {
  persistedIds: string[];
};

export function NewChatButton({ persistedIds }: NewChatButtonProps) {
  const pathname = usePathname();
  const router = useRouter();
  const activeId = pathname.slice(1);
  const isExistingChat = persistedIds.includes(activeId);

  return (
    <Button
      className="w-full"
      onClick={() => {
        router.push(`/${crypto.randomUUID()}`);
      }}
      disabled={!isExistingChat}
    >
      <PlusIcon />
      New chat
    </Button>
  );
}
