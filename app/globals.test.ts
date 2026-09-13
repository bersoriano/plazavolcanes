// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./globals.css", import.meta.url)), "utf8");

/** The declarations of the first rule whose selector is exactly `selector`. */
function block(selector: string) {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`No rule for ${selector}`);

  return css.slice(start, css.indexOf("\n}", start));
}

function token(selector: string, name: string) {
  return block(selector).match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();
}

describe("trust tier fill token", () => {
  it("keeps the ordinary theme's tier pill exactly as bg-accent/40 painted it", () => {
    expect(token(":root", "--trust-tier-fill")).toBe(
      "color-mix(in oklab, var(--accent) 40%, transparent)",
    );
  });

  it("tints the tier pill gold inside a premium scope, apart from the obsidian Premium badge", () => {
    const fill = token('[data-theme="premium"]', "--trust-tier-fill");

    expect(fill).toMatch(/var\(--premium-gold\)/);
    expect(fill).not.toMatch(/--premium-ink|#16131a/i);
  });
});
