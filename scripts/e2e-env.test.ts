import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

const wrapperPath = path.resolve(process.cwd(), "scripts/e2e-env.mjs");

function runWrapper(baseUrl?: string) {
  const fakeBin = mkdtempSync(path.join(tmpdir(), "plaza-e2e-env-"));
  const fakeNpx = path.join(fakeBin, "npx");
  writeFileSync(
    fakeNpx,
    [
      "#!/bin/sh",
      "printf '%s\\n' 'API_URL=\"http://127.0.0.1:54321\"'",
      "printf '%s\\n' 'PUBLISHABLE_KEY=\"test-publishable-key\"'",
    ].join("\n"),
  );
  chmodSync(fakeNpx, 0o755);

  const env = { ...process.env };
  if (baseUrl === undefined) delete env.PLAYWRIGHT_BASE_URL;
  else env.PLAYWRIGHT_BASE_URL = baseUrl;
  env.PATH = `${fakeBin}${path.delimiter}${env.PATH ?? ""}`;

  try {
    return spawnSync(
      process.execPath,
      [
        wrapperPath,
        process.execPath,
        "-e",
        "process.stdout.write(JSON.stringify({ port: process.env.PLAYWRIGHT_E2E_PORT, siteUrl: process.env.NEXT_PUBLIC_SITE_URL }))",
      ],
      { encoding: "utf8", env, timeout: 15_000 },
    );
  } finally {
    rmSync(fakeBin, { force: true, recursive: true });
  }
}

describe("local E2E environment wrapper", () => {
  it("assigns an ephemeral loopback app URL to each owned run", () => {
    const result = runWrapper();

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout) as { port?: string; siteUrl?: string };
    expect(output.port).toMatch(/^\d+$/);
    expect(Number(output.port)).toBeGreaterThan(0);
    expect(output.siteUrl).toBe(`http://127.0.0.1:${output.port}`);
  });

  it("rejects a caller-supplied loopback app URL", () => {
    const result = runWrapper("http://127.0.0.1:3000");

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Refusing caller-supplied PLAYWRIGHT_BASE_URL");
    expect(result.stdout).toBe("");
  });
});
