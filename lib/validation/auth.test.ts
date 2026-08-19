import { describe, expect, it } from "vitest";

import { authSchema } from "@/lib/validation/auth";

describe("authSchema", () => {
  it("accepts a valid email and eight-character password", () => {
    expect(
      authSchema.safeParse({
        email: "persona@volcanes.mx",
        password: "secreto12",
      }).success,
    ).toBe(true);
  });

  it("rejects malformed email and short password", () => {
    const result = authSchema.safeParse({
      email: "correo-invalido",
      password: "123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toEqual([
        "Escribe un correo válido.",
      ]);
      expect(result.error.flatten().fieldErrors.password).toEqual([
        "Usa al menos 8 caracteres.",
      ]);
    }
  });
});
