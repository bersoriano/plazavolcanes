import { defineConfig, devices } from "@playwright/test";

function isLoopbackHttpUrl(value: string) {
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

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim();

if (externalBaseUrl && !isLoopbackHttpUrl(externalBaseUrl)) {
  throw new Error(`Refusing non-loopback PLAYWRIGHT_BASE_URL: ${externalBaseUrl}`);
}

const ownedPort = Number(process.env.PLAYWRIGHT_E2E_PORT ?? "3000");
if (!Number.isInteger(ownedPort) || ownedPort < 1 || ownedPort > 65_535) {
  throw new Error(`Invalid PLAYWRIGHT_E2E_PORT: ${process.env.PLAYWRIGHT_E2E_PORT}`);
}

const ownedBaseUrl = `http://127.0.0.1:${ownedPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: externalBaseUrl ?? ownedBaseUrl,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: `npm run dev -- --hostname 127.0.0.1 --port ${ownedPort}`,
        url: ownedBaseUrl,
        reuseExistingServer: false,
      },
});
