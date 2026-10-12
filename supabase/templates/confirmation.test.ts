import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const template = readFileSync("supabase/templates/confirmation.html", "utf8");

describe("Spanish confirmation email", () => {
  it("brands the content and names its destination without claiming verification", () => {
    expect(template).toContain('lang="es"');
    expect(template).toContain("PLAZA VOLCANES");
    expect(template).toContain("{{ .Email }}");
    expect(template).toContain("permiso para publicar productos");
    expect(template).not.toContain("Supabase");
  });
  it("preserves the existing token-hash callback and all redirect context", () => {
    const hrefs = [...template.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    expect(hrefs).toEqual(["{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}"]);
    const rendered = hrefs[0].replace("{{ .RedirectTo }}", "https://plazavolcanes.com/auth/confirm?type=signup&continuar=%2Fpanel%2Fcuenta&intent=vender").replace("{{ .TokenHash }}", "test-token").replaceAll("&amp;", "&");
    const target = new URL(rendered);
    expect(target.pathname).toBe("/auth/confirm");
    expect(target.searchParams.get("type")).toBe("signup");
    expect(target.searchParams.get("intent")).toBe("vender");
    expect(target.searchParams.get("continuar")).toBe("/panel/cuenta");
    expect(target.searchParams.get("token_hash")).toBe("test-token");
  });
});
