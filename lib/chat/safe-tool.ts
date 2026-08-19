import "server-only";
import { toPublicErrorMessage } from "@/lib/chat/error-message";
import { logFailureToLangfuse } from "@/lib/observability/log-failure";

export async function executeTool<T>(
  name: string,
  run: () => Promise<T> | T,
): Promise<T | { error: string }> {
  try {
    return await run();
  } catch (error) {
    logFailureToLangfuse({
      source: "tool",
      error,
      extra: { tool: name },
    });
    console.error(`Tool ${name} failed`, error);

    return { error: toPublicErrorMessage(error) };
  }
}
