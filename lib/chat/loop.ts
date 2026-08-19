export const MAX_AGENT_STEPS = 8;

/** Per-tool execution timeouts. LLM-backed tools get more time than local math. */
export const AGENT_TIMEOUT = {
  totalMs: 55_000,
  stepMs: 20_000,
  toolMs: 8_000,
  tools: {
    queryInvoicesMs: 8_000,
    generateReportMs: 8_000,
    calculateMs: 2_000,
    convertCurrencyMs: 5_000,
    extractInvoiceMs: 45_000,
    categorizeExpenseMs: 20_000,
  },
} as const;

export class StepCountExceededError extends Error {
  readonly stepNumber: number;
  readonly maxSteps: number;

  constructor(stepNumber: number, maxSteps = MAX_AGENT_STEPS) {
    super(
      `Agent step ${stepNumber + 1} exceeds the maximum of ${maxSteps} steps.`,
    );
    this.name = "StepCountExceededError";
    this.stepNumber = stepNumber;
    this.maxSteps = maxSteps;
  }
}

export type PrepareAgentStepResult =
  | Record<string, never>
  | { activeTools: [] };

/**
 * Hard cap on the tool-calling loop. `stopWhen: isStepCount(maxSteps)` already
 * stops after that many completed steps; this also blocks starting another
 * model call past the limit, and forces a text-only answer on the last step.
 */
export function prepareAgentStep({
  stepNumber,
  maxSteps = MAX_AGENT_STEPS,
}: {
  stepNumber: number;
  maxSteps?: number;
}): PrepareAgentStepResult {
  if (stepNumber >= maxSteps) {
    throw new StepCountExceededError(stepNumber, maxSteps);
  }

  if (stepNumber === maxSteps - 1) {
    return { activeTools: [] };
  }

  return {};
}

export type AgentStepSummary = {
  stepNumber: number;
  finishReason: string;
  toolNames: string[];
  toolCallIds: string[];
  textPreview: string;
  tokensIn: number | undefined;
  tokensOut: number | undefined;
  tokensCached: number | undefined;
  tokensCacheWrite: number | undefined;
  stepTimeMs: number | undefined;
};

const TEXT_PREVIEW_CHARS = 500;

export function summarizeAgentStep(step: {
  stepNumber: number;
  finishReason: string;
  text?: string;
  toolCalls?: Array<{ toolName: string; toolCallId?: string }>;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    inputTokenDetails?: {
      cacheReadTokens?: number;
      cacheWriteTokens?: number;
    };
  };
  performance?: { stepTimeMs?: number };
}): AgentStepSummary {
  return {
    stepNumber: step.stepNumber,
    finishReason: step.finishReason,
    toolNames: step.toolCalls?.map((call) => call.toolName) ?? [],
    toolCallIds:
      step.toolCalls
        ?.map((call) => call.toolCallId)
        .filter((id): id is string => typeof id === "string" && id.length > 0) ??
      [],
    textPreview: (step.text ?? "").slice(0, TEXT_PREVIEW_CHARS),
    tokensIn: step.usage?.inputTokens,
    tokensOut: step.usage?.outputTokens,
    tokensCached: step.usage?.inputTokenDetails?.cacheReadTokens,
    tokensCacheWrite: step.usage?.inputTokenDetails?.cacheWriteTokens,
    stepTimeMs: step.performance?.stepTimeMs,
  };
}
