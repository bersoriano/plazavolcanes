import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// locator.selectOption fires input and change from one script, which hides
// controlled selects that a render between the two events resets. Specs pick
// through tests/e2e/pick-option.ts instead.
const E2E_DIR = "tests/e2e";

describe("e2e select picking", () => {
  it("never calls Playwright's selectOption directly", async () => {
    const offenders: string[] = [];
    for (const name of await readdir(E2E_DIR)) {
      if (!name.endsWith(".ts") || name === "pick-option.ts") continue;
      const source = await readFile(join(E2E_DIR, name), "utf8");
      source.split("\n").forEach((line, index) => {
        if (line.includes(".selectOption(")) offenders.push(`${name}:${index + 1}`);
      });
    }

    expect(offenders).toEqual([]);
  });
});
