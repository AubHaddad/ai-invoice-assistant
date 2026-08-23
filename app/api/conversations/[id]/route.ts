import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/session";
import {
  deleteConversation,
  getConversationForUser,
  getConversationUsage,
  isUuid,
  listConversationMessages,
  toConversationSummary,
  updateConversation,
} from "@/lib/chat/store";

const PatchConversationSchema = z
  .object({
    pinned: z.boolean().optional(),
    title: z.string().trim().min(1).max(100).optional(),
  })
  .refine(
    (value) => value.pinned !== undefined || value.title !== undefined,
    { message: "No updates provided" },
  );

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

  const [messages, usage] = await Promise.all([
    listConversationMessages(id),
    getConversationUsage(id),
  ]);

  return Response.json({
    conversation: toConversationSummary(conversation),
    messages,
    usage,
  });
}

export async function PATCH(
  req: Request,
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

  let json: unknown;

  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = PatchConversationSchema.safeParse(json);

  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const conversation = await updateConversation({
    id,
    userId,
    pinned: parsed.data.pinned,
    title: parsed.data.title,
  });

  if (!conversation) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  return Response.json({ conversation });
}

export async function DELETE(
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

  const deleted = await deleteConversation({ id, userId });

  if (!deleted) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
