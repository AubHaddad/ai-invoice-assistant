import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT } from "./prompts";

describe("SYSTEM_PROMPT", () => {
  it("sets a finance-assistant-for-invoices persona", () => {
    expect(SYSTEM_PROMPT).toMatch(/finance assistant for invoices/i);
  });

  it("requires calculate for arithmetic and forbids guessed numbers", () => {
    expect(SYSTEM_PROMPT).toMatch(/always call calculate/i);
    expect(SYSTEM_PROMPT).toMatch(/never invent figures/i);
    expect(SYSTEM_PROMPT).toMatch(/never add, subtract, average/i);
  });

  it("requires citing the conversion rate date", () => {
    expect(SYSTEM_PROMPT).toMatch(/cite the returned rate and rateDate/i);
  });

  it("asks for concise answers and tables when listing", () => {
    expect(SYSTEM_PROMPT).toMatch(/Be concise/);
    expect(SYSTEM_PROMPT).toMatch(/markdown table/i);
  });

  it("refuses off-topic requests and redirects to invoices", () => {
    expect(SYSTEM_PROMPT).toMatch(/politely refuse/i);
    expect(SYSTEM_PROMPT).toMatch(/off-topic/i);
  });

  it("replies in the user's language (FR / EN / AR)", () => {
    expect(SYSTEM_PROMPT).toMatch(/English, French, or Arabic/);
    expect(SYSTEM_PROMPT).toMatch(/FR \/ EN \/ AR/);
  });
});
