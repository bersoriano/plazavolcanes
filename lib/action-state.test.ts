import { describe, expect, it } from "vitest";

import { formValues, initialActionState } from "@/lib/action-state";

function formDataOf(entries: [string, string | File][]) {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

describe("formValues", () => {
  it("keeps what the person typed so a failed submit can restore it", () => {
    const data = formDataOf([
      ["name", "Casa Niebla"],
      ["description", "Objetos de barro."],
    ]);

    expect(formValues(data)).toEqual({
      name: "Casa Niebla",
      description: "Objetos de barro.",
    });
  });

  it("never echoes a password back to the browser", () => {
    const data = formDataOf([
      ["email", "persona@volcanes.mx"],
      ["password", "secreto12"],
    ]);

    expect(formValues(data)).toEqual({ email: "persona@volcanes.mx" });
  });

  it("skips uploaded files, which cannot be restored anyway", () => {
    const data = formDataOf([
      ["name", "Taza"],
      ["image", new File(["bytes"], "taza.jpg", { type: "image/jpeg" })],
    ]);

    expect(formValues(data)).toEqual({ name: "Taza" });
  });

  it("keeps every value of a repeated field", () => {
    const data = formDataOf([
      ["administrative_area_codes", "MX-JAL"],
      ["administrative_area_codes", "MX-COL"],
    ]);

    expect(formValues(data)).toEqual({
      administrative_area_codes: "MX-JAL",
      "administrative_area_codes[1]": "MX-COL",
    });
  });

  it("starts with no remembered values", () => {
    expect(initialActionState.values).toBeUndefined();
  });
});
