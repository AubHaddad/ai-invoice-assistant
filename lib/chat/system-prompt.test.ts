import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT } from "@/lib/ai/prompts";
import {
  cachedChatInstructions,
  conversationContextMessage,
  instructionsWithContext,
  instructionsWithDocuments,
  systemInstructionsText,
} from "./system-prompt";

describe("instructionsWithDocuments", () => {
  it("appends an empty-document note", () => {
    const instructions = instructionsWithDocuments([]);

    expect(instructions.startsWith(SYSTEM_PROMPT)).toBe(true);
    expect(instructions).toContain("Uploaded documents in this conversation: none yet.");
  });

  it("lists uploaded documents most-recent-first", () => {
    const instructions = instructionsWithDocuments([
      { id: "doc-1", fileName: "acme.pdf", mime: "application/pdf" },
    ]);

    expect(instructions).toContain(
      "1. acme.pdf (id: doc-1, type: application/pdf)",
    );
  });
});

describe("instructionsWithContext", () => {
  it("returns instructions unchanged when there are no notes", () => {
    expect(instructionsWithContext("base", [])).toBe("base");
    expect(instructionsWithContext("base", ["  "])).toBe("base");
  });

  it("appends trimmed notes", () => {
    expect(instructionsWithContext("base", [" Saved. "])).toBe(
      "base\n\nAdditional context:\n- Saved.",
    );
  });
});

describe("cachedChatInstructions", () => {
  it("caches the static system prompt and leaves document context uncached", () => {
    const extra = conversationContextMessage({
      documents: [{ id: "doc-1", fileName: "acme.pdf", mime: "application/pdf" }],
      notes: [],
    });
    const instructions = cachedChatInstructions(extra);

    expect(instructions).toHaveLength(2);
    expect(instructions[0]).toMatchObject({
      role: "system",
      content: SYSTEM_PROMPT,
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral" } },
      },
    });
    expect(instructions[1]).toEqual(extra);
    expect(instructions[1].providerOptions).toBeUndefined();
    expect(systemInstructionsText(instructions)).toContain("acme.pdf");
  });
});
