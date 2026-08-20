import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(root, ".env") });

const require = createRequire(import.meta.url);

function nodeMajor() {
  return Number(process.versions.node.split(".")[0]);
}

if (nodeMajor() < 22) {
  console.error(
    `promptfoo eval requires Node 22+. Detected ${process.version}.`,
  );
  process.exit(1);
}

const weakOnly = process.argv.includes("--weak");
const skipWeak = process.argv.includes("--skip-weak");
const port = process.env.EVAL_PORT || "3200";
const baseURL = `http://127.0.0.1:${port}`;
const configPath = path.join(root, "promptfooconfig.yaml");

function promptfooEnv(extra = {}) {
  return {
    ...process.env,
    PROMPTFOO_CONFIG_DIR: path.join(root, "evals/promptfoo/.promptfoo"),
    PROMPTFOO_DISABLE_TELEMETRY: "1",
    PROMPTFOO_DISABLE_UPDATE: "1",
    PROMPTFOO_CHAT_URL: baseURL,
    ...extra,
  };
}

function run(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: promptfooEnv(extraEnv),
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
      // Server not up yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Eval server did not become ready at ${url}`);
}

function startServer({ weakPrompt }) {
  const env = {
    ...process.env,
    EVAL_TEST_AUTH: "1",
    NEXT_DIST_DIR: weakPrompt ? ".next-eval-weak" : ".next-eval",
    AUTH_URL: baseURL,
    AUTH_TRUST_HOST: "true",
  };

  if (weakPrompt) {
    env.PROMPTFOO_WEAK_PROMPT = "1";
  } else {
    delete env.PROMPTFOO_WEAK_PROMPT;
  }

  const child = spawn("npx", ["next", "dev", "--port", String(port)], {
    cwd: root,
    env,
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

function readStats() {
  const outputPath = path.join(root, "evals/promptfoo/output/results.json");

  if (!fs.existsSync(outputPath)) {
    return null;
  }

  const payload = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  const results = Array.isArray(payload.results)
    ? payload.results
    : payload.results?.results;

  if (!Array.isArray(results)) {
    return payload.stat ?? payload.stats ?? null;
  }

  const failures = results.filter((row) => row.success === false).length;
  return {
    successes: results.length - failures,
    failures,
    total: results.length,
  };
}

async function withServer(weakPrompt, fn) {
  const server = startServer({ weakPrompt });

  try {
    await waitForServer(`${baseURL}/login`);
    return await fn();
  } finally {
    await stopServer(server);
  }
}

async function runEval({ weak }) {
  const args = [
    "promptfoo",
    "eval",
    "-c",
    configPath,
    "--no-cache",
  ];

  if (weak) {
    args.push("--filter-metadata", "sensitivity=weak");
  }

  return run("npx", args);
}

async function ensureBetterSqlite3() {
  try {
    require("better-sqlite3");
  } catch (error) {
    if (error && error.code !== "ERR_DLOPEN_FAILED") {
      throw error;
    }

    console.log(
      `Rebuilding better-sqlite3 for Node ${process.version} (promptfoo native binding)…`,
    );
    const code = await run("npm", ["rebuild", "better-sqlite3"]);

    if (code !== 0) {
      throw new Error("npm rebuild better-sqlite3 failed");
    }

    require("better-sqlite3");
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  if (!process.env.AUTH_SECRET) {
    throw new Error("AUTH_SECRET is not set");
  }

  await ensureBetterSqlite3();

  console.log("Seeding invoices for the prompt eval user…");
  const seedCode = await run("npx", ["tsx", "lib/db/seed.ts"]);

  if (seedCode !== 0) {
    process.exit(seedCode);
  }

  if (!weakOnly) {
    console.log(`\nRunning promptfoo against ${baseURL} (strong system prompt)…`);
    const strongCode = await withServer(false, () => runEval({ weak: false }));

    if (strongCode !== 0) {
      console.error("promptfoo eval failed against the real system prompt.");
      process.exit(strongCode);
    }

    console.log("Strong prompt eval passed.");
  }

  if (weakOnly || !skipWeak) {
    console.log(
      `\nRunning sensitivity check against ${baseURL} (weakened system prompt)…`,
    );
    const weakCode = await withServer(true, () => runEval({ weak: true }));
    const stats = readStats();
    const failed = weakCode !== 0 || (stats && stats.failures > 0);

    if (!failed) {
      console.error(
        "\nWEAK PROMPT CHECK FAILED: the eval still passed after weakening the system prompt. The suite is not sensitive enough.",
      );
      process.exit(1);
    }

    const summary = stats
      ? `${stats.failures}/${stats.total} cases failed`
      : "promptfoo reported failures";
    console.log(
      `\nWEAK PROMPT CHECK PASSED: ${summary}. Weakening the system prompt fails the eval loudly.`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
