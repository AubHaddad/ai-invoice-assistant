import { redirect } from "next/navigation";

export default function ChatIndexPage() {
  redirect(`/${crypto.randomUUID()}`);
}
