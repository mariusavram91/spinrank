import { readFile, rm, unlink } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

const PID_FILE = join(process.cwd(), "tests/e2e/.worker-server.pid");
const SKIP_WORKER_BOOT = process.env.PLAYWRIGHT_USE_EXTERNAL_WORKER === "1";
const WRANGLER_PERSIST_PATH = process.env.WRANGLER_PERSIST_PATH ?? "tests/e2e/.wrangler-state";

export default async function globalTeardown() {
  if (SKIP_WORKER_BOOT) {
    return;
  }

  try {
    const pidString = await readFile(PID_FILE, { encoding: "utf-8" });
    const pid = Number(pidString.trim());
    if (!Number.isNaN(pid)) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // ignore if already stopped
      }
    }
  } catch {
    // missing PID file is acceptable
  }

  try {
    await unlink(PID_FILE);
  } catch {
    // ignore if already removed
  }

  try {
    await rm(join(process.cwd(), "worker", WRANGLER_PERSIST_PATH), { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}
