import { eq } from "drizzle-orm";
import "server-only";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { E2E_TEST_EMAIL } from "./env";

export async function upsertE2EUser() {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, E2E_TEST_EMAIL))
    .limit(1);

  if (existing) {
    return {
      id: existing.id,
      email: existing.email,
      name: existing.name ?? "E2E User",
    };
  }

  const [created] = await db
    .insert(users)
    .values({
      email: E2E_TEST_EMAIL,
      name: "E2E User",
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create E2E test user.");
  }

  return {
    id: created.id,
    email: created.email,
    name: created.name ?? "E2E User",
  };
}
