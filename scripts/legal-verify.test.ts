import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { REQUIRED_LEGAL_TYPES } from "@/lib/legal/document-types";
import { PLATFORM_IDENTITY_VARS } from "@/lib/legal/platform-identity";

function readArray(source: string, name: string): string[] {
  const match = source.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  if (!match) throw new Error(`${name} not found in scripts/legal-verify.mjs`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
}

describe("legal-verify", () => {
  it("checks exactly the document types the registry requires", async () => {
    const source = await readFile("scripts/legal-verify.mjs", "utf8");

    expect(readArray(source, "REQUIRED_TYPES").sort()).toEqual(
      [...REQUIRED_LEGAL_TYPES].sort(),
    );
  });

  it("checks exactly the identity variables the config requires", async () => {
    const source = await readFile("scripts/legal-verify.mjs", "utf8");

    expect(readArray(source, "IDENTITY_VARS").sort()).toEqual(
      [...PLATFORM_IDENTITY_VARS].sort(),
    );
  });
});
