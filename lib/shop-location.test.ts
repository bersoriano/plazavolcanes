import { describe, expect, it } from "vitest";

import {
  MEXICO_ADMINISTRATIVE_AREAS,
  findAdministrativeAreaByCode,
  findAdministrativeAreaBySlug,
  formatShopLocation,
} from "@/lib/shop-location";

describe("formatShopLocation", () => {
  it("names the single state before the country", () => {
    expect(formatShopLocation("MX", ["MX-JAL"])).toBe("Jalisco, México");
  });

  it("joins two states with y", () => {
    expect(formatShopLocation("MX", ["MX-JAL", "MX-COL"])).toBe("Jalisco y Colima, México");
  });

  it("falls back to the country when no state is stored", () => {
    expect(formatShopLocation("MX", null)).toBe("México");
    expect(formatShopLocation("MX", [])).toBe("México");
  });

  it("ignores codes outside the supported catalog", () => {
    expect(formatShopLocation("MX", ["US-CA", "MX-OAX"])).toBe("Oaxaca, México");
  });
});

describe("administrative area slugs", () => {
  it("resolves a slug to its stored ISO code", () => {
    expect(findAdministrativeAreaBySlug("jalisco")?.code).toBe("MX-JAL");
    expect(findAdministrativeAreaBySlug("ciudad-de-mexico")?.code).toBe("MX-CMX");
  });

  it("returns undefined for a slug outside the catalog", () => {
    expect(findAdministrativeAreaBySlug("california")).toBeUndefined();
    expect(findAdministrativeAreaBySlug("")).toBeUndefined();
  });

  it("resolves a stored code back to its area", () => {
    expect(findAdministrativeAreaByCode("MX-OAX")?.slug).toBe("oaxaca");
    expect(findAdministrativeAreaByCode("US-CA")).toBeUndefined();
  });

  it("gives every area a URL safe slug", () => {
    for (const area of MEXICO_ADMINISTRATIVE_AREAS) {
      expect(area.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
    expect(new Set(MEXICO_ADMINISTRATIVE_AREAS.map((area) => area.slug)).size).toBe(
      MEXICO_ADMINISTRATIVE_AREAS.length,
    );
  });
});
