import { describe, expect, it } from "vitest";

import {
  contactMessageSchema,
  visitorContactMessageSchema,
} from "@/lib/validation/contact-message";

const visitor = {
  name: "Luis Pérez",
  email: "luis@correo.test",
  phone: "55 8765 4321",
  message: "No llegó mi pedido.",
};

const fieldErrors = (input: unknown) => {
  const result = visitorContactMessageSchema.safeParse(input);
  return result.success ? {} : result.error.flatten().fieldErrors;
};

describe("contactMessageSchema", () => {
  it("trims the message", () => {
    expect(contactMessageSchema.parse({ message: "  ¿Cómo cambio mi correo?  " })).toEqual({
      message: "¿Cómo cambio mi correo?",
    });
  });

  it.each([["Hola"], ["   corto   "], [""], [null], ["a".repeat(2001)]])(
    "refuses %j",
    (message) => {
      const result = contactMessageSchema.safeParse({ message });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        "Escribe un mensaje de entre 10 y 2000 caracteres.",
      );
    },
  );

  it("asks for nothing but the message", () => {
    expect(contactMessageSchema.safeParse({ message: "El vendedor no responde." }).success).toBe(true);
  });
});

describe("visitorContactMessageSchema", () => {
  it("returns what was typed, trimmed, with the phone in its stored form", () => {
    expect(
      visitorContactMessageSchema.parse({ ...visitor, name: "  Luis Pérez ", email: " luis@correo.test " }),
    ).toEqual({
      name: "Luis Pérez",
      email: "luis@correo.test",
      phone: "+525587654321",
      message: "No llegó mi pedido.",
    });
  });

  it.each([
    ["name", "L", "Escribe tu nombre."],
    ["name", null, "Escribe tu nombre."],
    ["name", "a".repeat(121), "Tu nombre debe tener 120 caracteres o menos."],
    ["email", "sin-arroba", "Escribe un correo válido."],
    ["email", "", "Escribe un correo válido."],
    ["phone", "12345", "Escribe tu teléfono móvil a 10 dígitos."],
    ["phone", null, "Escribe tu teléfono móvil a 10 dígitos."],
    ["message", "Hola", "Escribe un mensaje de entre 10 y 2000 caracteres."],
  ])("says what is wrong with %s = %j", (field, value, message) => {
    expect(fieldErrors({ ...visitor, [field]: value })[field as keyof typeof visitor]).toEqual([
      message,
    ]);
  });

  it("names every field left empty at once", () => {
    expect(Object.keys(fieldErrors({})).sort()).toEqual(["email", "message", "name", "phone"]);
  });
});
