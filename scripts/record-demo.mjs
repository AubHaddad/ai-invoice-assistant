import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { encode } from "next-auth/jwt";
import pg from "pg";
import { chromium } from "@playwright/test";
import { buildTextPdf } from "../evals/pdf.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const port = process.env.DEMO_PORT || "3000";
const baseURL = process.env.DEMO_BASE_URL || `http://localhost:${port}`;
const startOwnServer = process.env.DEMO_START_SERVER === "1";
const SEED_EMAIL = "aub.haddad@gmail.com";
const SESSION_COOKIE = "authjs.session-token";
const docsDir = path.join(root, "docs");
const gifPath = path.join(docsDir, "demo.gif");

const INVOICE_TEXT = [
  "ACME CLOUD LTD",
  "Invoice",
  "Invoice number: INV-7781",
  "Issue date: 2026-08-15",
  "Due date: 2026-09-14",
  "Bill to: Invoice Assistant",
  "",
  "Description                     Qty    Unit     Amount",
  "Cloud hosting — August 2026       1   250.00    250.00",
  "Support retainer                  1    50.00     50.00",
  "",
  "Subtotal                                  300.00 USD",
  "Tax 0%                                      0.00",
  "Total                                     300.00 USD",
].join("\n");

function run(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, ...extraEnv },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} exited via ${signal}`));
        return;
      }
      resolve(code ?? 1);
    });
  });
}

async function waitForServer(url, timeoutMs = 180_000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || [301, 302, 303, 307, 308].includes(response.status)) {
        return;
      }
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  throw new Error(`Demo server did not become ready at ${url}`);
}

function startServer() {
  const child = spawn("npx", ["next", "dev", "--port", String(port)], {
    cwd: root,
    env: {
      ...process.env,
      EVAL_TEST_AUTH: "1",
      NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || ".next-demo",
      AUTH_URL: baseURL,
      AUTH_TRUST_HOST: "true",
    },
    stdio: "inherit",
    detached: true,
  });

  return child;
}

async function stopServer(child) {
  if (!child.pid) {
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }

  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);

  if (child.exitCode === null) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  }
}

async function loadSeedAuth() {
  const secret = process.env.AUTH_SECRET;
  const databaseUrl = process.env.DATABASE_URL;

  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const { rows } = await client.query("select id from users where email = $1", [
      SEED_EMAIL,
    ]);
    const userId = rows[0]?.id;

    if (!userId) {
      throw new Error(`Seed user ${SEED_EMAIL} not found. Run npm run db:seed first.`);
    }

    const token = await encode({
      salt: SESSION_COOKIE,
      secret,
      token: {
        sub: userId,
        email: SEED_EMAIL,
        name: "Demo User",
      },
    });

    return token;
  } finally {
    await client.end();
  }
}

async function typeMessage(page, text) {
  const box = page.getByLabel("Chat message");
  await box.click();
  await box.pressSequentially(text, { delay: 28 });
  await page.waitForTimeout(400);
  await page.getByLabel("Send message").click();
}

async function waitReady(page) {
  await page.getByLabel("Chat message").waitFor({ state: "visible" });
  await page.getByLabel("Send message").waitFor({ state: "visible", timeout: 60_000 });
}

async function record(token) {
  fs.mkdirSync(docsDir, { recursive: true });
  const videoDir = path.join(docsDir, ".demo-video");
  fs.rmSync(videoDir, { recursive: true, force: true });
  fs.mkdirSync(videoDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: videoDir,
      size: { width: 1280, height: 800 },
    },
  });

  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value: token,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  const page = await context.newPage();
  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = "nextjs-portal { display: none !important; }";
    document.documentElement.appendChild(style);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.error("browser:", msg.text());
    }
  });
  page.on("requestfailed", (request) => {
    console.error("request failed:", request.method(), request.url(), request.failure()?.errorText);
  });

  const conversationId = randomUUID();
  await page.goto(`${baseURL}/${conversationId}`, { waitUntil: "networkidle" });
  await page.getByLabel("Chat message").waitFor({ timeout: 30_000 });
  await page.waitForTimeout(800);

  const pdfPath = path.join(videoDir, "acme-cloud-inv-7781.pdf");
  fs.writeFileSync(pdfPath, buildTextPdf(INVOICE_TEXT));

  await page.locator('input[aria-label="Upload invoice"]').setInputFiles(pdfPath);
  try {
    await page.getByText("Uploaded", { exact: true }).waitFor({ timeout: 45_000 });
  } catch (error) {
    await page.screenshot({
      path: path.join(docsDir, "demo-upload-failure.png"),
      fullPage: true,
    });
    console.error("Upload UI:\n", (await page.locator("body").innerText()).slice(0, 2500));
    throw error;
  }
  await page.waitForTimeout(600);
  await page.getByLabel("Send message").click();

  await page.getByTestId("invoice-card").waitFor({ timeout: 60_000 });
  await page.getByRole("button", { name: "Save" }).waitFor({ timeout: 15_000 });
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByText("Saved", { exact: true }).waitFor({ timeout: 20_000 });
  await page.waitForTimeout(500);
  await page.getByLabel("Close invoice review").click();
  await waitReady(page);
  await page.waitForTimeout(600);

  await typeMessage(page, "What is the total of this invoice?");
  await waitReady(page);
  await page.getByText("300 USD").first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(900);

  await typeMessage(page, "Show me a yearly spending chart by category.");
  await page.getByTestId("spending-chart").first().waitFor({ timeout: 60_000 });
  await page.getByTestId("spending-chart").first().scrollIntoViewIfNeeded();
  await page.getByText("Yearly report by category").first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(2800);

  const video = page.video();
  await page.close();
  const webmPath = video ? await video.path() : null;
  await context.close();
  await browser.close();

  if (!webmPath || !fs.existsSync(webmPath)) {
    throw new Error("Playwright did not write a video file");
  }

  return webmPath;
}

function findFfmpeg() {
  const fromEnv = process.env.FFMPEG_PATH?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) {
    return fromEnv;
  }

  for (const candidate of ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"]) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "ffmpeg";
}

async function toGif(webmPath) {
  const ffmpeg = findFfmpeg();
  const vf =
    "tpad=stop_mode=clone:stop_duration=6,fps=12,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5";
  const code = await run(ffmpeg, ["-y", "-i", webmPath, "-vf", vf, "-loop", "0", gifPath]);

  if (code !== 0) {
    throw new Error("ffmpeg failed to convert the demo video to GIF");
  }

  const bytes = fs.statSync(gifPath).size;
  console.log(`Wrote ${gifPath} (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  console.log("Seeding invoices and FX rates…");
  const seedCode = await run("npx", ["tsx", "lib/db/seed.ts"]);
  if (seedCode !== 0) {
    process.exit(seedCode);
  }
  const ratesCode = await run("npx", ["tsx", "lib/db/seed-rates.ts"]);
  if (ratesCode !== 0) {
    process.exit(ratesCode);
  }

  const token = await loadSeedAuth();
  const server = startOwnServer ? startServer() : null;

  try {
    if (server) {
      await waitForServer(`${baseURL}/login`);
    } else {
      await waitForServer(`${baseURL}/login`, 15_000);
    }
    console.log(`Recording demo against ${baseURL}…`);
    const webmPath = await record(token);
    console.log("Converting to GIF…");
    await toGif(webmPath);
  } finally {
    if (server) {
      await stopServer(server);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
