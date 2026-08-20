import { NextRequest } from "next/server";
import { isE2ETestAuth } from "@/lib/e2e/env";
import { memoryPutObject } from "@/lib/storage/memory";

export async function PUT(req: NextRequest) {
  if (!isE2ETestAuth()) {
    return new Response("Not found", { status: 404 });
  }

  const key = req.nextUrl.searchParams.get("key")?.trim();

  if (!key) {
    return Response.json({ error: "Missing storage key" }, { status: 400 });
  }

  const bytes = Buffer.from(await req.arrayBuffer());
  memoryPutObject(key, bytes);

  return new Response(null, { status: 200 });
}
