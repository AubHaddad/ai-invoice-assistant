import { getCurrentUserId } from "@/lib/auth/session";
import {
  EMPTY_CONVERSATION_USAGE,
  getConversationForUser,
  getConversationUsage,
  isUuid,
} from "@/lib/chat/store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  if (!isUuid(id)) {
    return Response.json({ error: "Invalid conversation id" }, { status: 400 });
  }

  const conversation = await getConversationForUser(id, userId);

  if (!conversation) {
    return Response.json({ usage: EMPTY_CONVERSATION_USAGE });
  }

  const usage = await getConversationUsage(id);

  return Response.json({ usage });
}
