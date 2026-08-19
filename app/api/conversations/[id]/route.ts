import { getCurrentUserId } from "@/lib/auth/session";
import {
  getConversationForUser,
  isUuid,
  listConversationMessages,
  toConversationSummary,
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
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  const messages = await listConversationMessages(id);

  return Response.json({
    conversation: toConversationSummary(conversation),
    messages,
  });
}
