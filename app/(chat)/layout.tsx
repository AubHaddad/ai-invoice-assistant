import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { UserMenu } from "@/components/auth/user-menu";

export default async function ChatLayout({
  children,
}: LayoutProps<"/">) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <p className="font-heading text-sm font-medium">Invoice Assistant</p>
        <UserMenu user={session.user} />
      </header>
      {children}
    </div>
  );
}
