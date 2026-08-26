import { describe, expect, it } from "vitest";

import {
  PLATFORM_IDENTITY_VARS,
  readPlatformIdentity,
} from "@/lib/legal/platform-identity";

const complete = {
  PLAZA_LEGAL_ENTITY_NAME: "Ejemplo S.A. de C.V.",
  PLAZA_LEGAL_RFC: "EJE010101AB1",
  PLAZA_LEGAL_ADDRESS: "Calle Falsa 123, Guadalajara, Jalisco, 44100",
  PLAZA_LEGAL_EMAIL: "contacto@ejemplo.mx",
  PLAZA_LEGAL_PHONE: "+523312345678",
  PLAZA_LEGAL_ATTENTION_HOURS: "Lunes a viernes de 9:00 a 18:00",
  PLAZA_PRIVACY_CONTACT: "datos@ejemplo.mx",
};

describe("readPlatformIdentity", () => {
  it("names every variable it needs", () => {
    expect(PLATFORM_IDENTITY_VARS).toHaveLength(7);
  });

  it("returns the identity when every variable is present", () => {
    const result = readPlatformIdentity(complete);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.identity.entityName).toBe("Ejemplo S.A. de C.V.");
    expect(result.identity.rfc).toBe("EJE010101AB1");
  });

  it("lists what is missing instead of throwing", () => {
    const result = readPlatformIdentity({
      ...complete,
      PLAZA_LEGAL_RFC: "",
      PLAZA_PRIVACY_CONTACT: undefined,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toEqual(["PLAZA_LEGAL_RFC", "PLAZA_PRIVACY_CONTACT"]);
  });

  it("treats an invalid RFC as missing rather than accepting it", () => {
    const result = readPlatformIdentity({ ...complete, PLAZA_LEGAL_RFC: "nope" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toContain("PLAZA_LEGAL_RFC");
  });
});
