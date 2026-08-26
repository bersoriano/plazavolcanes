import { describe, expect, it } from "vitest";

import { safeContinuation } from "@/lib/safe-continuation";

describe("safeContinuation", () => {
  it("accepts an internal path", () => {
    expect(safeContinuation("/carrito/7")).toBe("/carrito/7");
  });

  it("keeps a query string and fragment", () => {
    expect(safeContinuation("/productos/taza?compra=1#detalle")).toBe(
      "/productos/taza?compra=1#detalle",
    );
  });

  it("refuses an absolute URL", () => {
    expect(safeContinuation("https://evil.example/phish")).toBeNull();
    expect(safeContinuation("http://plazavolcanes.com/panel")).toBeNull();
  });

  it("refuses a protocol-relative URL", () => {
    expect(safeContinuation("//evil.example/phish")).toBeNull();
  });

  it("refuses a backslash, which some browsers read as a slash", () => {
    expect(safeContinuation("/\\evil.example")).toBeNull();
    expect(safeContinuation("\\\\evil.example")).toBeNull();
    expect(safeContinuation("/carrito\\7")).toBeNull();
  });

  it("refuses an encoded escape out of the site", () => {
    expect(safeContinuation("/%2f%2fevil.example")).toBeNull();
    expect(safeContinuation("/%5c%5cevil.example")).toBeNull();
    expect(safeContinuation("%2F%2Fevil.example")).toBeNull();
  });

  it("refuses a scheme hidden by whitespace or control characters", () => {
    expect(safeContinuation("/\tjavascript:alert(1)")).toBeNull();
    expect(safeContinuation("/panel\nSet-Cookie: a=b")).toBeNull();
    expect(safeContinuation(" /panel")).toBeNull();
  });

  it("refuses anything that is not a non-empty string starting with a slash", () => {
    expect(safeContinuation("panel")).toBeNull();
    expect(safeContinuation("")).toBeNull();
    expect(safeContinuation(null)).toBeNull();
    expect(safeContinuation(undefined)).toBeNull();
    expect(safeContinuation(42)).toBeNull();
    expect(safeContinuation({ toString: () => "/panel" })).toBeNull();
  });

  it("refuses a value long enough to be a smuggled payload", () => {
    expect(safeContinuation(`/${"a".repeat(600)}`)).toBeNull();
  });

  it("refuses malformed percent encoding rather than guessing", () => {
    expect(safeContinuation("/carrito/%zz")).toBeNull();
  });
});
