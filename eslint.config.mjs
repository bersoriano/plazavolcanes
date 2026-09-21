import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next, but matched at any depth: a git
    // worktree checked out inside the repo brings its own build output, and
    // linting a second .next costs minutes and reports thousands of nits.
    "**/.next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "**/supabase/.temp/**",
  ]),
]);

export default eslintConfig;
