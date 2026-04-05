import { spawn } from "node:child_process";
import process from "node:process";

const wranglerEnv = process.env.WRANGLER_ENV ?? "dev";
const workerHost = process.env.WORKER_HOST ?? "127.0.0.1";
const workerPort = process.env.WORKER_PORT ?? "8787";
const persistPath = process.env.WRANGLER_PERSIST_PATH ?? ".wrangler/state";
const defaultAppEnv = wranglerEnv === "prod" ? "prod" : "dev";

const childEnv = {
  ...process.env,
  APP_ENV: process.env.APP_ENV ?? defaultAppEnv,
};

const startWorker = () =>
  spawn(
    "npx",
    [
      "wrangler",
      "dev",
      "--env",
      wranglerEnv,
      `--persist-to=${persistPath}`,
      "--ip",
      workerHost,
      "--port",
      workerPort,
    ],
    {
      env: childEnv,
      stdio: "inherit",
    },
  );

const child = startWorker();

const forwardSignal = (signal) => {
  try {
    child.kill(signal);
  } catch {
    // ignore if already terminated
  }
};

["SIGINT", "SIGTERM", "SIGHUP"].forEach((signal) => {
  process.on(signal, () => forwardSignal(signal));
});

child.on("close", (code, signal) => {
  if (signal) {
    process.exitCode = 1;
  } else if (code !== null && code !== 0) {
    process.exitCode = code;
  }
});
