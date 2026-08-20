import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { encode } from "next-auth/jwt";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(root, ".env") });

const SEED_EMAIL = "aub.haddad@gmail.com";
const SESSION_COOKIE = "authjs.session-token";

let cachedAuth = null;

function chatUrl() {
  return (
    process.env.PROMPTFOO_CHAT_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:3200"
  );
}

async function loadSeedAuth() {
  if (cachedAuth) {
    return cachedAuth;
  }

  const secret = process.env.AUTH_SECRET;
  const databaseUrl = process.env.DATABASE_URL;

  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const { rows } = await client.query(
      "select id from users where email = $1",
      [SEED_EMAIL],
    );
    const userId = rows[0]?.id;

    if (!userId) {
      throw new Error(
        `Seed user ${SEED_EMAIL} not found. Run npm run db:seed first.`,
      );
    }

    const token = await encode({
      salt: SESSION_COOKIE,
      secret,
      token: {
        sub: userId,
        email: SEED_EMAIL,
        name: "Seed User",
      },
    });

    cachedAuth = { userId, cookie: `${SESSION_COOKIE}=${token}` };
    return cachedAuth;
  } finally {
    await client.end();
  }
}

function parseSse(raw) {
  const tools = [];
  let output = "";
  let errorText = "";

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed.startsWith("data:")) {
      continue;
    }

    const data = trimmed.slice(5).trim();

    if (!data || data === "[DONE]") {
      continue;
    }

    let event;

    try {
      event = JSON.parse(data);
    } catch {
      continue;
    }

    if (!event || typeof event !== "object") {
      continue;
    }

    if (typeof event.toolName === "string" && event.toolName) {
      tools.push(event.toolName);
    }

    if (event.type === "text-delta") {
      output += event.delta ?? event.text ?? "";
    } else if (event.type === "text" && typeof event.text === "string") {
      output += event.text;
    } else if (event.type === "error") {
      errorText += event.errorText ?? event.error ?? JSON.stringify(event);
    }
  }

  return {
    output: output.trim(),
    tools: [...new Set(tools)],
    errorText,
  };
}

export default class InvoiceAssistantChatProvider {
  constructor(options = {}) {
    this.providerId = options.id || "invoice-assistant-chat";
    this.config = options.config || {};
  }

  id() {
    return this.providerId;
  }

  async callApi(prompt) {
    try {
      const auth = await loadSeedAuth();
      const conversationId = randomUUID();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90_000);

      let response;

      try {
        response = await fetch(`${chatUrl()}/api/chat`, {
          method: "POST",
          headers: {
            Accept: "text/event-stream",
            "Content-Type": "application/json",
            Cookie: auth.cookie,
          },
          body: JSON.stringify({
            id: conversationId,
            messages: [
              {
                id: randomUUID(),
                role: "user",
                parts: [{ type: "text", text: String(prompt) }],
              },
            ],
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      const raw = await response.text();

      if (!response.ok) {
        return {
          error: `Chat endpoint ${response.status}: ${raw.slice(0, 500)}`,
        };
      }

      const parsed = parseSse(raw);

      if (parsed.errorText) {
        return {
          error: parsed.errorText,
          metadata: { tools: parsed.tools },
        };
      }

      if (!parsed.output) {
        return {
          error: `Empty assistant output. Tools: ${parsed.tools.join(", ") || "none"}. Body: ${raw.slice(0, 400)}`,
          metadata: { tools: parsed.tools },
        };
      }

      return {
        output: parsed.output,
        metadata: { tools: parsed.tools },
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
