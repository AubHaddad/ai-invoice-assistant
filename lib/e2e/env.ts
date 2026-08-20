export const E2E_TEST_EMAIL = "e2e@invoice.test";

export function isE2ETestAuth() {
  return process.env["E2E_TEST_AUTH"] === "1";
}

/** Promptfoo / live chat evals. Skips rate limits without faking the LLM. */
export function isEvalTestAuth() {
  return process.env["EVAL_TEST_AUTH"] === "1";
}

export function skipChatRateLimit() {
  return isE2ETestAuth() || isEvalTestAuth();
}
