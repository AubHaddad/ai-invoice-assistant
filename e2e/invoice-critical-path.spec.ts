import { expect, test } from "@playwright/test";
import { buildTextPdf } from "../evals/pdf";

const INVOICE_TOTAL = "100.00 USD";

function fixtureInvoicePdf() {
  return buildTextPdf(
    [
      "Acme Corp",
      "Invoice INV-9001",
      "Date: 2026-08-01",
      `Total: ${INVOICE_TOTAL}`,
      "Line: Consulting services",
    ].join("\n"),
  );
}

test("upload, save, and recall the last invoice total", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in as test user" }).click();
  await expect(page.getByLabel("Chat message")).toBeVisible();

  await page.locator('input[aria-label="Upload invoice"]').setInputFiles({
    name: "acme-invoice.pdf",
    mimeType: "application/pdf",
    buffer: fixtureInvoicePdf(),
  });
  await expect(page.getByText("Uploaded", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByLabel("Send message")).toBeEnabled();

  await page.getByLabel("Send message").click();
  await expect(page.getByTestId("invoice-card")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("invoice-card")).toContainText("Acme Corp");
  await expect(page.getByTestId("invoice-card")).toContainText(/100/);

  const reviewHeading = page.getByRole("heading", { name: "Invoice review" });
  if (!(await reviewHeading.isVisible())) {
    await page.getByRole("button", { name: "Review" }).click();
  }
  await expect(reviewHeading).toBeVisible();

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.getByLabel("Close invoice review").click();
  await expect(reviewHeading).toBeHidden();

  await expect(page.getByLabel("Send message")).toBeVisible({ timeout: 30_000 });

  await page.getByLabel("Chat message").fill(
    "what is the total of the last invoice?",
  );
  await expect(page.getByLabel("Send message")).toBeEnabled();
  await page.getByLabel("Send message").click();

  await expect(page.getByText(INVOICE_TOTAL)).toBeVisible();
});
