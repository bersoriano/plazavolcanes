import { describe, expect, it } from "vitest";

import { isInternalPath, platformNoticeSchema } from "@/lib/validation/platform-notice";

const notice = { title: "Mantenimiento", body: "El sábado por la noche.", action_href: "", action_label: "" };

const firstMessage = (input: unknown) => {
  const result = platformNoticeSchema.safeParse(input);
  return result.success ? null : result.error.issues[0]?.message;
};

describe("isInternalPath", () => {
  it.each(["/", "/panel", "/tiendas/casa-niebla", "/explorar?q=barro&orden=nuevo", "/mensajes/12#fin"])(
    "accepts %s",
    (path) => expect(isInternalPath(path)).toBe(true),
  );

  it.each([
    "https://evil.test/x",
    "//evil.test/x",
    "/\\evil.test",
    "panel",
    "javascript:alert(1)",
    // A browser drops tabs and line breaks from a URL, leaving "//evil.test".
    "/\t/evil.test",
    "/\n/evil.test",
    "/panel con espacios",
    "/a:b",
    "/usuario@evil.test",
    "",
  ])("refuses %j", (path) => expect(isInternalPath(path)).toBe(false));
});

describe("platformNoticeSchema", () => {
  it("accepts a notice without a link, as nulls", () => {
    expect(platformNoticeSchema.parse(notice)).toEqual({
      title: "Mantenimiento",
      body: "El sábado por la noche.",
      action_href: null,
      action_label: null,
    });
  });

  it("trims what was typed", () => {
    expect(
      platformNoticeSchema.parse({
        title: "  Mantenimiento ",
        body: " El sábado. ",
        action_href: " /panel ",
        action_label: " Ir a mi panel ",
      }),
    ).toEqual({
      title: "Mantenimiento",
      body: "El sábado.",
      action_href: "/panel",
      action_label: "Ir a mi panel",
    });
  });

  it("asks for a title and a message", () => {
    expect(firstMessage({ ...notice, title: "  " })).toBe("Escribe un título.");
    expect(firstMessage({ ...notice, body: "" })).toBe("Escribe un mensaje.");
  });

  it("keeps the title and the message inside what the inbox can show", () => {
    expect(firstMessage({ ...notice, title: "a".repeat(121) })).toBe(
      "El título debe tener 120 caracteres o menos.",
    );
    expect(firstMessage({ ...notice, body: "a".repeat(2001) })).toBe(
      "El mensaje debe tener 2000 caracteres o menos.",
    );
    expect(platformNoticeSchema.safeParse({ ...notice, title: "a".repeat(120) }).success).toBe(true);
  });

  it("keeps a link inside the plaza", () => {
    expect(firstMessage({ ...notice, action_href: "https://evil.test", action_label: "Abrir" })).toBe(
      "El enlace debe empezar con / y quedarse dentro de la plaza.",
    );
    expect(firstMessage({ ...notice, action_href: "/" + "a".repeat(300), action_label: "Abrir" })).toBe(
      "El enlace debe tener 300 caracteres o menos.",
    );
  });

  it("wants a link and its button text together", () => {
    expect(firstMessage({ ...notice, action_href: "/panel" })).toBe("Escribe el texto del botón.");
    expect(firstMessage({ ...notice, action_label: "Abrir" })).toBe(
      "El texto del botón necesita un enlace.",
    );
  });

  it("keeps the button text short", () => {
    expect(firstMessage({ ...notice, action_href: "/panel", action_label: "a".repeat(41) })).toBe(
      "El texto del botón debe tener 40 caracteres o menos.",
    );
  });

  it("reads a missing field the way it reads an empty one", () => {
    expect(firstMessage({ title: null, body: "Hola" })).toBe("Escribe un título.");
    expect(platformNoticeSchema.safeParse({ title: "Hola", body: "Cuerpo" }).success).toBe(true);
  });
});
