#!/usr/bin/env node
/**
 * Runs a command against the local Supabase stack, whatever `.env.local` says.
 *
 * The end-to-end spec registers accounts, creates a shop and sends messages.
 * `.env.local` points at the linked remote project, and Playwright's webServer
 * starts `npm run dev`, which reads it — so running Playwright bare drives
 * production. Next leaves variables already present in the environment alone,
 * so setting them here wins.
 *
 * Values come from `supabase status` rather than being hardcoded, because the
 * local keys change when the stack is recreated.
 */
import { execFileSync, spawn } from "node:child_process";

function localCredentials() {
  let raw;
  try {
    raw = execFileSync("npx", ["supabase", "status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }

  const read = (key) => raw.match(new RegExp(`^${key}="(.*)"$`, "m"))?.[1] ?? null;
  const url = read("API_URL");
  const publishableKey = read("PUBLISHABLE_KEY");

  return url && publishableKey ? { url, publishableKey } : null;
}

const local = localCredentials();

if (!local) {
  console.error(
    [
      "",
      "  Local Supabase is not running, and these tests must never run against",
      "  the linked remote project — they create accounts, shops and messages.",
      "",
      "    supabase start",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

if (!/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(local.url)) {
  console.error(`\n  Refusing to run: ${local.url} is not a local address.\n`);
  process.exit(1);
}

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("\n  Usage: node scripts/e2e-env.mjs <command> [args...]\n");
  process.exit(1);
}

const child = spawn(command, args, {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: local.url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.publishableKey,
    NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000",
  },
});

child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
child.on("error", (error) => {
  console.error(`\n  Could not start ${command}: ${error.message}\n`);
  process.exit(1);
});
