import { describe, expect, it } from "vitest";
import {
  AGENT_TIMEOUT,
  MAX_AGENT_STEPS,
  prepareAgentStep,
  StepCountExceededError,
  summarizeAgentStep,
} from "./loop";

describe("prepareAgentStep", () => {
  it("leaves tools enabled for earlier steps", () => {
    expect(prepareAgentStep({ stepNumber: 0 })).toEqual({});
    expect(prepareAgentStep({ stepNumber: MAX_AGENT_STEPS - 2 })).toEqual({});
  });

  it("disables tools on the last allowed step so the model must answer", () => {
    expect(prepareAgentStep({ stepNumber: MAX_AGENT_STEPS - 1 })).toEqual({
      activeTools: [],
    });
  });

  it("throws when the step count is exceeded", () => {
    expect(() => prepareAgentStep({ stepNumber: MAX_AGENT_STEPS })).toThrow(
      StepCountExceededError,
    );
    expect(() => prepareAgentStep({ stepNumber: MAX_AGENT_STEPS + 1 })).toThrow(
      /exceeds the maximum of 8/,
    );
  });

  it("uses a custom max when provided", () => {
    expect(prepareAgentStep({ stepNumber: 4, maxSteps: 5 })).toEqual({
      activeTools: [],
    });
    expect(() => prepareAgentStep({ stepNumber: 5, maxSteps: 5 })).toThrow(
      StepCountExceededError,
    );
  });
});

describe("AGENT_TIMEOUT", () => {
  it("sets a default tool timeout and per-tool overrides", () => {
    expect(AGENT_TIMEOUT.toolMs).toBeGreaterThan(0);
    expect(AGENT_TIMEOUT.tools.queryInvoicesMs).toBeGreaterThan(0);
    expect(AGENT_TIMEOUT.tools.generateReportMs).toBeGreaterThan(0);
    expect(AGENT_TIMEOUT.tools.calculateMs).toBeLessThan(
      AGENT_TIMEOUT.tools.extractInvoiceMs,
    );
    expect(AGENT_TIMEOUT.tools.convertCurrencyMs).toBeGreaterThan(0);
    expect(AGENT_TIMEOUT.tools.categorizeExpenseMs).toBeGreaterThan(0);
  });
});

describe("summarizeAgentStep", () => {
  it("extracts chained tool names for Langfuse", () => {
    expect(
      summarizeAgentStep({
        stepNumber: 2,
        finishReason: "tool-calls",
        text: "Converting to EUR",
        toolCalls: [
          { toolName: "convertCurrency", toolCallId: "call_1" },
          { toolName: "calculate", toolCallId: "call_2" },
        ],
        usage: { inputTokens: 120, outputTokens: 40 },
        performance: { stepTimeMs: 350 },
      }),
    ).toEqual({
      stepNumber: 2,
      finishReason: "tool-calls",
      toolNames: ["convertCurrency", "calculate"],
      toolCallIds: ["call_1", "call_2"],
      textPreview: "Converting to EUR",
      tokensIn: 120,
      tokensOut: 40,
      tokensCached: undefined,
      tokensCacheWrite: undefined,
      stepTimeMs: 350,
    });
  });

  it("includes cached input tokens from usage details", () => {
    expect(
      summarizeAgentStep({
        stepNumber: 0,
        finishReason: "stop",
        usage: {
          inputTokens: 5000,
          outputTokens: 40,
          inputTokenDetails: {
            cacheReadTokens: 4000,
            cacheWriteTokens: 200,
          },
        },
      }),
    ).toMatchObject({
      tokensIn: 5000,
      tokensOut: 40,
      tokensCached: 4000,
      tokensCacheWrite: 200,
    });
  });
});
