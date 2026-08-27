import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";

import { describe, expect, it } from "vitest";

// Claims the product may not make without a documented programme and evidence
// behind them. LFPC art. 32 requires information to be veraz y comprobable;
// each of these was live once and removed. See the design spec §3.
const FORBIDDEN = [
  "compra protegida",
  "pago seguro",
  "garantizado",
  "vendedor verificado",
  "altamente verificado",
  "sin riesgo",
  "arbitraje",
  "cumplimiento profeco",
  "concilianet",
];

const TRACKERS = ["googletagmanager", "gtag(", "next/script", "hotjar", "posthog", "facebook.net"];

const ROOTS = ["app", "components", "lib"];
const EXTENSIONS = new Set([".ts", ".tsx"]);

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });

  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      if (!EXTENSIONS.has(extname(entry.name))) return [];
      // Test files legitimately name the forbidden strings in order to assert
      // their absence.
      if (entry.name.includes(".test.")) return [];
      return [path];
    }),
  );

  return nested.flat();
}

describe("claims audit", () => {
  it("makes no claim the platform cannot evidence", async () => {
    const files = (await Promise.all(ROOTS.map(sourceFiles))).flat();
    const offences: string[] = [];

    for (const file of files) {
      const contents = (await readFile(file, "utf8")).toLowerCase();
      for (const claim of FORBIDDEN) {
        if (contents.includes(claim)) offences.push(`${file}: "${claim}"`);
      }
    }

    expect(offences).toEqual([]);
  });

  it("loads no third-party tracking", async () => {
    const files = (await Promise.all(ROOTS.map(sourceFiles))).flat();
    const offences: string[] = [];

    for (const file of files) {
      const contents = (await readFile(file, "utf8")).toLowerCase();
      for (const tracker of TRACKERS) {
        if (contents.includes(tracker)) offences.push(`${file}: "${tracker}"`);
      }
    }

    expect(offences).toEqual([]);
  });
});
