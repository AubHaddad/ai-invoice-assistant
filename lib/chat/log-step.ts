import { startObservation } from "@langfuse/tracing";
import "server-only";
import { summarizeAgentStep, type AgentStepSummary } from "./loop";

export function logAgentStepToLangfuse(step: {
  stepNumber: number;
  finishReason: string;
  text?: string;
  toolCalls?: Array<{ toolName: string; toolCallId?: string }>;
  usage?: { inputTokens?: number; outputTokens?: number };
  performance?: { stepTimeMs?: number };
}): AgentStepSummary | undefined {
  const summary = summarizeAgentStep(step);

  try {
    startObservation(
      "agent-step",
      {
        input: {
          toolNames: summary.toolNames,
          toolCallIds: summary.toolCallIds,
        },
        output: {
          finishReason: summary.finishReason,
          textPreview: summary.textPreview,
        },
        metadata: {
          stepNumber: summary.stepNumber,
          tokensIn: summary.tokensIn,
          tokensOut: summary.tokensOut,
          stepTimeMs: summary.stepTimeMs,
          chainedTools: summary.toolNames,
        },
      },
      { asType: "event" },
    );
  } catch (error) {
    console.error("Failed to log agent step to Langfuse", error);
  }

  return summary;
}
