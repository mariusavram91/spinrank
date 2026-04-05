import { spawnSync } from "node:child_process";
import process from "node:process";

if (process.env.SKIP_HOOK === "1") {
  console.log("SKIP_HOOK=1, skipping core.hooksPath setup.");
  process.exit(0);
}

const result = spawnSync("git", ["config", "core.hooksPath", ".githooks"], {
  stdio: "inherit",
});

if (result.error) {
  console.error("Failed to configure git hooks:", result.error.message);
  process.exit(result.status || 1);
}

