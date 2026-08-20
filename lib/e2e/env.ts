export const E2E_TEST_EMAIL = "e2e@invoice.test";

export function isE2ETestAuth() {
  return process.env["E2E_TEST_AUTH"] === "1";
}
