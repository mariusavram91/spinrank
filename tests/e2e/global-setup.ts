import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

const WORKER_BASE_URL = process.env.WORKER_BASE_URL ?? "http://127.0.0.1:8787";
const PID_FILE = join(process.cwd(), "tests/e2e/.worker-server.pid");
const TEST_AUTH_SECRET = process.env.TEST_AUTH_SECRET ?? "test-auth-secret";
const APP_ORIGIN = process.env.APP_ORIGIN ?? "http://127.0.0.1:4173";
const SKIP_WORKER_BOOT = process.env.PLAYWRIGHT_USE_EXTERNAL_WORKER === "1";

const waitForWorker = async () => {
  const healthUrl = `${WORKER_BASE_URL.replace(/\/$/, "")}/health`;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const res = await fetch(healthUrl, { method: "GET" });
      if (res.ok) {
        return;
      }
    } catch {
      /* ignore */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Worker dev server failed to start within the timeout window.");
};

export default async function globalSetup() {
  if (SKIP_WORKER_BOOT) {
    await waitForWorker();
    return;
  }

  const child = spawn("npm", ["run", "dev:test"], {
    cwd: join(process.cwd(), "worker"),
    env: {
      ...process.env,
      APP_ENV: "test",
      TEST_AUTH_SECRET,
      APP_ORIGIN,
    },
    stdio: "inherit",
  });

  await writeFile(PID_FILE, String(child.pid), { encoding: "utf-8" });

  try {
    await waitForWorker();
  } catch (error) {
    child.kill("SIGTERM");
    throw error;
  }
}
