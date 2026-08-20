import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import authConfig from "./auth.config";
import { drizzleAdapter } from "@/lib/auth/drizzle-adapter";
import { isE2ETestAuth } from "@/lib/e2e/env";
import { upsertE2EUser } from "@/lib/e2e/user";

const e2eCredentials = Credentials({
  id: "e2e",
  name: "E2E",
  credentials: {
    login: { label: "Login", type: "text" },
  },
  async authorize() {
    if (!isE2ETestAuth()) {
      return null;
    }

    return upsertE2EUser();
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: drizzleAdapter(),
  ...authConfig,
  providers: isE2ETestAuth()
    ? [...authConfig.providers, e2eCredentials]
    : authConfig.providers,
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
  },
});
