import { describe, expect, it } from "vitest";

import {
  authSchema,
  emailSchema,
  newPasswordSchema,
  normalizeMexicanMobile,
  signUpSchema,
} from "@/lib/validation/auth";

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

describe("signUpSchema", () => {
  const credentials = { email: "persona@volcanes.mx", password: "secreto12", display_name: "Ana Ruiz" };

  it("stores a ten digit number in E.164", () => {
    const result = signUpSchema.safeParse({ ...credentials, phone: "3312345678" });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phone).toBe("+523312345678");
  });

  it("accepts the digits however they were typed", () => {
    for (const input of ["33 1234 5678", "(33) 1234-5678", "+52 33 1234 5678", "523312345678"]) {
      const result = signUpSchema.safeParse({ ...credentials, phone: input });

      expect(result.success).toBe(true);
      if (result.success) expect(result.data.phone).toBe("+523312345678");
    }
  });

  it("requires a name a shop can address them by", () => {
    const result = signUpSchema.safeParse({
      email: "persona@volcanes.mx",
      password: "secreto12",
      phone: "3312345678",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a name too short to mean anything", () => {
    const result = signUpSchema.safeParse({ ...credentials, display_name: "A", phone: "3312345678" });

    expect(result.success).toBe(false);
  });

  it("requires a phone number", () => {
    const result = signUpSchema.safeParse({ ...credentials, phone: "" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.phone?.[0]).toBe(
        "Escribe tu teléfono móvil a 10 dígitos.",
      );
    }
  });

  it("rejects numbers that are not ten digits", () => {
    for (const input of ["331234567", "33123456789", "abcdefghij"]) {
      expect(signUpSchema.safeParse({ ...credentials, phone: input }).success).toBe(false);
    }
  });

  it("still rejects a bad email alongside a good phone", () => {
    const result = signUpSchema.safeParse({
      email: "correo-invalido",
      password: "secreto12",
      phone: "3312345678",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email?.[0]).toBe("Escribe un correo válido.");
    }
  });
});

describe("normalizeMexicanMobile", () => {
  it("returns null when the digits cannot form a mobile number", () => {
    expect(normalizeMexicanMobile("123")).toBeNull();
    expect(normalizeMexicanMobile("")).toBeNull();
  });

  it("returns the E.164 form when they can", () => {
    expect(normalizeMexicanMobile("33 1234 5678")).toBe("+523312345678");
  });
});

describe("emailSchema", () => {
  it("accepts an address on its own", () => {
    expect(emailSchema.safeParse({ email: "ana@correo.com" }).success).toBe(true);
  });

  it("rejects a malformed address", () => {
    const result = emailSchema.safeParse({ email: "ana" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email?.[0]).toBe("Escribe un correo válido.");
    }
  });
});

describe("newPasswordSchema", () => {
  it("accepts two matching passwords", () => {
    const result = newPasswordSchema.safeParse({
      password: "volcanes2026",
      password_confirm: "volcanes2026",
    });

    expect(result.success).toBe(true);
  });

  it("reports a mismatch on the confirmation field", () => {
    const result = newPasswordSchema.safeParse({
      password: "volcanes2026",
      password_confirm: "volcanes2027",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password_confirm?.[0]).toBe(
        "Las contraseñas no coinciden.",
      );
    }
  });

  it("keeps the eight-character minimum the sign-up form uses", () => {
    const result = newPasswordSchema.safeParse({ password: "corta", password_confirm: "corta" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password?.[0]).toBe("Usa al menos 8 caracteres.");
    }
  });
});
