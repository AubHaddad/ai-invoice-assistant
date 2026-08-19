import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function ChatLayout({
  children,
}: LayoutProps<"/">) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return <div className="flex min-h-0 flex-1">{children}</div>;
}
