import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, ".env") });

const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL,
    headless: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npx next dev --port ${port}`,
    url: `${baseURL}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...process.env,
      E2E_TEST_AUTH: "1",
      NEXT_DIST_DIR: ".next-e2e",
      AUTH_SECRET:
        process.env.AUTH_SECRET || "e2e-auth-secret-e2e-auth-secret-32ch",
      AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID || "e2e-google-id",
      AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET || "e2e-google-secret",
    },
  },
});
