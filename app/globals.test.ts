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

describe("base border colour", () => {
  // Tailwind v4 puts utilities in @layer utilities, and an unlayered rule beats
  // every layered one whatever its specificity, so a bare `* { border-color }`
  // would silently repaint every border-brand, border-transparent and
  // border-premium-gold in the app as --border.
  it("sits inside @layer base so border colour utilities can win over it", () => {
    const layer = css.indexOf("@layer base {");
    expect(layer).not.toBe(-1);

    const base = css.slice(layer, css.indexOf("\n}", layer));
    expect(base).toMatch(/\*\s*\{\s*border-color:\s*var\(--border\);\s*\}/);
  });

  it("leaves no unlayered border-color rule on *", () => {
    expect(css).not.toMatch(/^\*\s*\{\s*border-color:/m);
  });
});

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

describe("premium scope", () => {
  it("asks native controls to render dark inside the scope", () => {
    expect(token('[data-theme="premium"]', "color-scheme")).toBe("dark");
  });

  it("leaves text colour to the wrapper's text-ink class", () => {
    expect(block('[data-theme="premium"]')).not.toMatch(/^\s*color:/m);
  });

  it("offers a cream ink token for light text on premium ink", () => {
    expect(token(":root", "--premium-cream")).toBe("#f5f1ea");
    expect(css).toMatch(/--color-premium-cream:\s*var\(--premium-cream\);/);
  });
});
