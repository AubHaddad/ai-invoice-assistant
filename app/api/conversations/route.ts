import { getCurrentUserId } from "@/lib/auth/session";
import { listConversations } from "@/lib/chat/store";

export async function GET() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const conversations = await listConversations(userId);

  return Response.json({ conversations });
}
