import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LandingStores, rankShops } from "@/components/home/landing/landing-stores";
import type { CatalogShop } from "@/lib/queries/catalog.server";

afterEach(cleanup);

function shop(id: number, overrides: Partial<CatalogShop> = {}): CatalogShop {
  return {
    administrative_area_codes: ["MX-OAX"],
    country_code: "MX",
    created_at: "2026-08-01T00:00:00.000Z",
    delivery_policy: null,
    delivery_policy_updated_at: null,
    description: "Piezas hechas a mano.",
    id,
    image_path: null,
    imageUrl: null,
    is_publishing_approved: true,
    is_premium: false,
    publishing_reviewed_at: null,
    listing_limit: 15,
    founder_since: null,
    name: `Tienda ${id}`,
    owner_id: `owner-${id}`,
    slug: `tienda-${id}`,
    time_zone: "America/Mexico_City",
    trust_evaluated_at: null,
    trust_tier: "standard",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("rankShops", () => {
  it("leads with founders inside their 90 days, then the usual order", () => {
    const now = Date.parse("2026-10-10T12:00:00Z");
    const ranked = rankShops(
      [
        shop(1, { is_premium: true }),
        shop(2, { founder_since: "2026-10-01T00:00:00Z" }),
        shop(3, { founder_since: "2026-01-01T00:00:00Z" }),
        shop(4),
      ],
      now,
    );

    expect(ranked.map((item) => item.id)).toEqual([2, 1, 3, 4]);
  });

  it("puts premium first, then the higher tier, then a cover photo, and keeps recency for ties", () => {
    const ranked = rankShops([
      shop(1),
      shop(2, { imageUrl: "https://example.com/2.jpg" }),
      shop(3, { trust_tier: "reliable" }),
      shop(4, { is_premium: true }),
      shop(5),
    ]);

    expect(ranked.map((item) => item.id)).toEqual([4, 3, 2, 1, 5]);
  });
});

describe("LandingStores", () => {
  it("is the #tiendas anchor and ends on the invite card", () => {
    render(<LandingStores shops={[shop(1), shop(2)]} />);

    const section = screen.getByRole("region", { name: "Tiendas de la plaza." });
    expect(section).toHaveAttribute("id", "tiendas");
    const links = within(section).getAllByRole("link");
    expect(links.at(-1)).toHaveAttribute("href", "/vender?desde=tiendas");
  });

  it("shows up to seven shops and the open seat", () => {
    render(<LandingStores shops={Array.from({ length: 9 }, (_, index) => shop(index + 1))} />);

    expect(screen.getAllByRole("link", { name: /Tienda \d/ })).toHaveLength(7);
    expect(screen.getByRole("link", { name: /Tu tienda podría estar aquí/ })).toBeInTheDocument();
  });

  it("still offers the open seat when no shop exists yet", () => {
    render(<LandingStores shops={[]} />);

    expect(screen.getByRole("link", { name: /Tu tienda podría estar aquí/ })).toBeInTheDocument();
  });
});
