"use client";

import { LogOutIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth/actions";

type SidebarUserProps = {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
};

function initials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export function SidebarUser({ user }: SidebarUserProps) {
  const userName = user.name?.trim() || user.email?.trim() || "Signed in";

  return (
    <div className="flex items-center gap-2">
      <Avatar size="sm" className="shrink-0">
        {user.image ? <AvatarImage src={user.image} alt={userName} /> : null}
        <AvatarFallback>{initials(user.name, user.email)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {userName}
      </span>
      <form action={signOutAction}>
        <Button
          type="submit"
          variant="ghost"
          size="icon-sm"
          aria-label="Sign out"
        >
          <LogOutIcon />
        </Button>
      </form>
    </div>
  );
}
