import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { drizzleAdapter } from "@/lib/auth/drizzle-adapter";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: drizzleAdapter(),
  ...authConfig,
});
