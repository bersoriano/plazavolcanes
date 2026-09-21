import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    exclude: [
      // Matched at any depth: a git worktree checked out inside the repo brings
      // its own node_modules, and dependencies ship their own test suites.
      "**/node_modules/**",
      // Playwright owns tests/e2e. Its spec files match the default include
      // pattern, and calling test() outside a Playwright runner throws.
      "**/tests/e2e/**",
      // A nested worktree is a second checkout with its own `npm test`; running
      // its copy of this suite here doubles the work and proves nothing.
      "**/.claude/**",
      "**/.worktrees/**",
    ],
  },
});
