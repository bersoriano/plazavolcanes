import { afterEach, describe, expect, it } from "vitest";

afterEach(() => window.localStorage.clear());

describe("the browser the tests run in", () => {
  it("has a localStorage that keeps what it is given", () => {
    window.localStorage.setItem("clave", "valor");

    expect(window.localStorage.getItem("clave")).toBe("valor");
  });
});
