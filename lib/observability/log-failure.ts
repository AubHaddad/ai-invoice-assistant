import { propagateAttributes, startObservation } from "@langfuse/tracing";
import "server-only";
import { toPublicErrorMessage } from "@/lib/chat/error-message";

export const FAILURE_TAG = "error";

export type FailureSource = "tool" | "provider" | "db" | "stream" | "route";

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return "Unknown error";
}

export function logFailureToLangfuse({
  source,
  error,
  extra,
}: {
  source: FailureSource | string;
  error: unknown;
  extra?: Record<string, unknown>;
}) {
  const message = errorMessage(error);

  try {
    propagateAttributes({ tags: [FAILURE_TAG] }, () => {
      startObservation(
        "failure",
        {
          level: "ERROR",
          statusMessage: message,
          input: { source },
          output: {
            error: message,
            publicMessage: toPublicErrorMessage(error),
          },
          metadata: {
            source,
            name: error instanceof Error ? error.name : undefined,
            ...extra,
          },
        },
        { asType: "event" },
      );
    });
  } catch (logError) {
    console.error("Failed to log failure to Langfuse", logError);
  }
}
