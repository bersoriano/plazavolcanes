import { describe, expect, it } from "vitest";

import {
  altContactSchema,
  checkoutMetadataSchema,
  checkoutSchema,
  quantitySchema,
} from "@/lib/validation/commerce";

describe("commerce validation", () => {
  it.each([1, 99])("accepts cart quantity %i", (quantity) => {
    expect(quantitySchema.parse(String(quantity))).toBe(quantity);
  });

  it.each([0, 100, "1.5", "x"])("rejects invalid cart quantity %s", (quantity) => {
    expect(quantitySchema.safeParse(String(quantity)).success).toBe(false);
  });

  it("normalizes a complete delivery address", () => {
    expect(checkoutSchema.parse({
      recipient: "  María López ",
      address_line1: " Calle Uno 10 ",
      address_line2: "",
      locality: " Guadalajara ",
      administrative_area: " Jalisco ",
      postal_code: " 44100 ",
      country_code: "MX",
      delivery_instructions: "",
      buyer_note: "",
      idempotency_key: "10000000-0000-4000-8000-000000000099",
    })).toEqual({
      recipient: "María López",
      address_line1: "Calle Uno 10",
      address_line2: null,
      locality: "Guadalajara",
      administrative_area: "Jalisco",
      postal_code: "44100",
      country_code: "MX",
      delivery_instructions: null,
      buyer_note: null,
      idempotency_key: "10000000-0000-4000-8000-000000000099",
    });
  });

  it("rejects checkout without required locality", () => {
    const result = checkoutSchema.safeParse({
      recipient: "María López",
      address_line1: "Calle Uno 10",
      locality: "",
      administrative_area: "Jalisco",
      postal_code: "44100",
      country_code: "MX",
      idempotency_key: "10000000-0000-4000-8000-000000000099",
    });
    expect(result.success).toBe(false);
  });
});

describe("altContactSchema", () => {
  it("normalises a ten-digit national number", () => {
    const parsed = altContactSchema.parse({ name: "Luis", phone: "3312345678", note: "" });
    expect(parsed.phone).toBe("+523312345678");
  });

  it("refuses a phone with no name", () => {
    expect(altContactSchema.safeParse({ name: "", phone: "3312345678", note: "" }).success).toBe(false);
  });

  it("accepts an entirely empty contact", () => {
    const parsed = altContactSchema.parse({ name: "", phone: "", note: "" });
    expect(parsed).toEqual({ name: null, phone: null, note: null });
  });

  it.each([
    {
      field: "name",
      input: { name: "x".repeat(81), phone: "", note: "" },
      message: "El nombre de la otra persona no puede pasar de 80 caracteres.",
    },
    {
      field: "note",
      input: { name: "Luis", phone: "", note: "x".repeat(201) },
      message: "La nota de la otra persona no puede pasar de 200 caracteres.",
    },
  ])("localizes the $field length bound", ({ field, input, message }) => {
    const result = altContactSchema.safeParse(input);

    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({ path: [field], message }),
    );
  });
});

describe("checkoutMetadataSchema", () => {
  const idempotencyKey = "10000000-0000-4000-8000-000000000099";

  it.each([
    { note: "", expected: null },
    { note: "  Nos vemos en la entrada.  ", expected: "Nos vemos en la entrada." },
  ])("normalizes the shared buyer note '$note'", ({ note, expected }) => {
    expect(checkoutMetadataSchema.parse({
      buyer_note: note,
      idempotency_key: idempotencyKey,
    })).toEqual({
      buyer_note: expected,
      idempotency_key: idempotencyKey,
    });
  });

  it.each([
    { idempotency_key: undefined, buyer_note: "" },
    { idempotency_key: "not-a-uuid", buyer_note: "" },
    { idempotency_key: idempotencyKey, buyer_note: "x".repeat(1001) },
  ])("rejects malformed shared checkout metadata %#", (metadata) => {
    expect(checkoutMetadataSchema.safeParse(metadata).success).toBe(false);
  });

  it("localizes the buyer note length bound", () => {
    const result = checkoutMetadataSchema.safeParse({
      buyer_note: "x".repeat(1001),
      idempotency_key: idempotencyKey,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({
        path: ["buyer_note"],
        message: "La nota para el vendedor no puede pasar de 1000 caracteres.",
      }),
    );
  });
});

describe("optional shipping field bounds", () => {
  const shipping = {
    recipient: "Ana Ruiz",
    address_line1: "Calle Volcán 12",
    address_line2: "",
    locality: "Guadalajara",
    administrative_area: "Jalisco",
    postal_code: "44100",
    country_code: "MX",
    delivery_instructions: "",
    buyer_note: "",
    idempotency_key: "10000000-0000-4000-8000-000000000099",
  };

  it.each([
    {
      field: "address_line2",
      value: "x".repeat(201),
      message: "El interior o referencia no puede pasar de 200 caracteres.",
    },
    {
      field: "delivery_instructions",
      value: "x".repeat(501),
      message: "Las instrucciones de entrega no pueden pasar de 500 caracteres.",
    },
  ])("localizes the $field length bound", ({ field, value, message }) => {
    const result = checkoutSchema.safeParse({ ...shipping, [field]: value });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({ path: [field], message }),
    );
  });
});
