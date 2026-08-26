import { describe, expect, it } from "vitest";

import {
  LEGAL_DOCUMENT_TYPES,
  LEGAL_ROUTES,
  REQUIRED_LEGAL_TYPES,
} from "@/lib/legal/document-types";

describe("legal document registry", () => {
  it("lists every type the migration seeds", () => {
    expect(LEGAL_DOCUMENT_TYPES).toHaveLength(10);
    expect(LEGAL_DOCUMENT_TYPES).toContain("platform_terms");
    expect(LEGAL_DOCUMENT_TYPES).toContain("marketplace_role");
  });

  it("exposes eight public routes", () => {
    expect(LEGAL_ROUTES).toHaveLength(8);
    expect(LEGAL_ROUTES.map((route) => route.path)).toEqual([
      "/terminos",
      "/privacidad",
      "/compras-y-devoluciones",
      "/garantias",
      "/envios",
      "/seguridad",
      "/quejas-y-aclaraciones",
      "/terminos-vendedores",
    ]);
  });

  it("routes only to types the registry knows", () => {
    for (const route of LEGAL_ROUTES) {
      expect(LEGAL_DOCUMENT_TYPES).toContain(route.type);
    }
  });

  it("requires every seeded type", () => {
    expect(REQUIRED_LEGAL_TYPES).toEqual(LEGAL_DOCUMENT_TYPES);
  });
});
