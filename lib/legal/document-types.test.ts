import { describe, expect, it } from "vitest";

import {
  LEGAL_DOCUMENT_TYPES,
  LEGAL_ROUTES,
} from "@/lib/legal/document-types";

describe("legal document registry", () => {
  it("lists all ten document types explicitly", () => {
    expect(LEGAL_DOCUMENT_TYPES).toEqual([
      "platform_terms",
      "privacy_notice",
      "returns_policy",
      "warranty_policy",
      "shipping_policy",
      "security_guidance",
      "complaints_policy",
      "seller_terms",
      "buyer_terms",
      "marketplace_role",
    ]);
  });

  it("has no duplicate types in the registry", () => {
    const seen = new Set<string>();
    for (const type of LEGAL_DOCUMENT_TYPES) {
      expect(seen).not.toContain(type);
      seen.add(type);
    }
  });

  it("exposes eight public routes with no duplicates", () => {
    expect(LEGAL_ROUTES).toHaveLength(8);
    const paths = new Set<string>();
    const types = new Set<string>();
    for (const route of LEGAL_ROUTES) {
      expect(paths).not.toContain(route.path);
      expect(types).not.toContain(route.type);
      paths.add(route.path);
      types.add(route.type);
    }
  });

  it("routes only to types the registry knows", () => {
    for (const route of LEGAL_ROUTES) {
      expect(LEGAL_DOCUMENT_TYPES).toContain(route.type);
    }
  });

  it("has exactly two types with no public route: buyer_terms and marketplace_role", () => {
    const routed = new Set(LEGAL_ROUTES.map((r) => r.type));
    const unrouted = LEGAL_DOCUMENT_TYPES.filter((t) => !routed.has(t));
    expect(unrouted).toEqual(["buyer_terms", "marketplace_role"]);
  });

  it("all route labels and titles are non-empty", () => {
    for (const route of LEGAL_ROUTES) {
      expect(route.navLabel.trim()).not.toBe("");
      expect(route.title.trim()).not.toBe("");
    }
  });
});
