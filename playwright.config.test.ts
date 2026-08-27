import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import config from "./playwright.config";

describe("Playwright local server ownership", () => {
  it("starts its own loopback server without reusing another process", () => {
    const webServer = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer;

    expect(webServer).toBeDefined();
    expect(webServer).toMatchObject({ reuseExistingServer: false });
    expect(webServer?.command).toContain("--hostname 127.0.0.1");
    expect(webServer?.url).toBe(config.use?.baseURL);
  });

  it("rejects a non-loopback external base URL during config loading", () => {
    const result = spawnSync("npx", ["playwright", "test", "--list"], {
      encoding: "utf8",
      env: { ...process.env, PLAYWRIGHT_BASE_URL: "https://example.com" },
      timeout: 15_000,
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "Refusing non-loopback PLAYWRIGHT_BASE_URL",
    );
  });
});
