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
import { createServer } from "node:net";

function isLoopbackHttpUrl(value) {
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      ["127.0.0.1", "localhost", "[::1]", "::1"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

function availableLoopbackPort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen({ exclusive: true, host: "127.0.0.1", port: 0 }, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;

      server.close((error) => {
        if (error) reject(error);
        else if (port === null) reject(new Error("Could not allocate a loopback port."));
        else resolve(port);
      });
    });
  });
}

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim();

if (externalBaseUrl && !isLoopbackHttpUrl(externalBaseUrl)) {
  console.error(
    `\n  Refusing to run against non-loopback PLAYWRIGHT_BASE_URL: ${externalBaseUrl}\n`,
  );
  process.exit(1);
}

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

const ownedPort = externalBaseUrl ? null : await availableLoopbackPort();
const appUrl = externalBaseUrl ?? `http://127.0.0.1:${ownedPort}`;

const child = spawn(command, args, {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: local.url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.publishableKey,
    NEXT_PUBLIC_SITE_URL: appUrl,
    ...(ownedPort === null ? {} : { PLAYWRIGHT_E2E_PORT: String(ownedPort) }),
  },
});

child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
child.on("error", (error) => {
  console.error(`\n  Could not start ${command}: ${error.message}\n`);
  process.exit(1);
});
