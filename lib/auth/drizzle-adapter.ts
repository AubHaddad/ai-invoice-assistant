import { and, eq, getTableColumns } from "drizzle-orm";
import type { Adapter, AdapterAccount } from "next-auth/adapters";
import { db } from "@/lib/db";
import { accounts, users } from "@/lib/db/schema";

// @auth/drizzle-adapter's DrizzleAdapter() still detects drizzle-orm 0.x
// PgDatabase, which 1.0 replaced with PgAsyncDatabase. This adapter uses
// the same user/account methods against our Drizzle schema.

function toAdapterUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image,
  };
}

export function drizzleAdapter(): Adapter {
  return {
    async createUser(data) {
      const { id, ...insertData } = data;
      const hasDefaultId = getTableColumns(users).id.hasDefault;

      const [user] = await db
        .insert(users)
        .values(hasDefaultId ? insertData : { ...insertData, id })
        .returning();

      if (!user) {
        throw new Error("Failed to create user.");
      }

      return toAdapterUser(user);
    },
    async getUser(id) {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user ? toAdapterUser(user) : null;
    },
    async getUserByEmail(email) {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user ? toAdapterUser(user) : null;
    },
    async getUserByAccount({ provider, providerAccountId }) {
      const [row] = await db
        .select({ user: users })
        .from(accounts)
        .innerJoin(users, eq(accounts.userId, users.id))
        .where(
          and(
            eq(accounts.provider, provider),
            eq(accounts.providerAccountId, providerAccountId),
          ),
        );

      return row?.user ? toAdapterUser(row.user) : null;
    },
    async updateUser({ id, ...data }) {
      const [user] = await db
        .update(users)
        .set(data)
        .where(eq(users.id, id))
        .returning();

      if (!user) {
        throw new Error("No user found.");
      }

      return toAdapterUser(user);
    },
    async deleteUser(id) {
      await db.delete(users).where(eq(users.id, id));
    },
    async linkAccount(data) {
      await db.insert(accounts).values(data as typeof accounts.$inferInsert);
    },
    async unlinkAccount({ provider, providerAccountId }) {
      await db
        .delete(accounts)
        .where(
          and(
            eq(accounts.provider, provider),
            eq(accounts.providerAccountId, providerAccountId),
          ),
        );
    },
    async getAccount(providerAccountId, provider) {
      const [account] = await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.provider, provider),
            eq(accounts.providerAccountId, providerAccountId),
          ),
        );

      return (account as AdapterAccount | undefined) ?? null;
    },
  };
}
