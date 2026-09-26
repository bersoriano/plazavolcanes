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

  it("shows two shops in the desktop grid and up to six in the phone's scroller", () => {
    render(<LandingStores shops={Array.from({ length: 8 }, (_, index) => shop(index + 1))} />);

    const cards = screen.getAllByRole("link", { name: /Tienda \d/ });
    expect(cards).toHaveLength(6);
    expect(cards.filter((card) => card.classList.contains("lg:hidden"))).toHaveLength(4);
  });

  it("still offers the open seat when no shop exists yet", () => {
    render(<LandingStores shops={[]} />);

    expect(screen.getByRole("link", { name: /Tu tienda podría estar aquí/ })).toBeInTheDocument();
  });
});
