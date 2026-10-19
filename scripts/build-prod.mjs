#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import process from "node:process";

// Force disable mock authentication during production bundle compilation
process.env.NEXT_PUBLIC_MOCK_AUTH = "false";
process.env.NODE_ENV = "production";

console.log("🔒 [Build] Enforced NEXT_PUBLIC_MOCK_AUTH=false for production build.");

const isWindows = process.platform === "win32";
const nextCmd = isWindows ? "npx.cmd" : "npx";

const result = spawnSync(nextCmd, ["next", "build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PUBLIC_MOCK_AUTH: "false",
    NODE_ENV: "production",
  },
  shell: isWindows,
});

process.exit(result.status ?? 0);
