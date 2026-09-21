import { describe, expect, it } from "vitest";

import { getSellerPublicationState, type SellerListingFlags } from "@/lib/seller-publication";

const live: SellerListingFlags = {
  status: "published",
  expires_at: "2099-01-01T00:00:00.000Z",
  is_admin_enabled: true,
  is_publishing_approved: true,
  publishing_reviewed_at: "2026-09-01T00:00:00.000Z",
};

describe("getSellerPublicationState", () => {
  it("names an unpublished listing a private draft", () => {
    const state = getSellerPublicationState({ ...live, status: "draft", expires_at: null });

    expect(state).toMatchObject({ kind: "draft", label: "Borrador privado", isPublic: false });
  });

  it("marks who or what is holding a listing back, so a caller never reads the label", () => {
    const kinds = [
      getSellerPublicationState(live).kind,
      getSellerPublicationState({ ...live, status: "expired" }).kind,
      getSellerPublicationState({ ...live, is_publishing_approved: false, publishing_reviewed_at: null }).kind,
      getSellerPublicationState({ ...live, is_publishing_approved: false }).kind,
      getSellerPublicationState({ ...live, is_admin_enabled: false }).kind,
      getSellerPublicationState({ ...live, expires_at: "2020-01-01T00:00:00.000Z" }).kind,
    ];

    expect(kinds).toEqual([
      "published",
      "expired",
      "awaiting_approval",
      "shop_disabled",
      "admin_disabled",
      "expired",
    ]);
  });
});
