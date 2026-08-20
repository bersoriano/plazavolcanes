import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PublicShopCard } from "@/components/catalog/shop-card";

describe("PublicShopCard", () => {
  it("shows shop state and country", () => {
    render(
      <PublicShopCard
        shop={{
          id: 1,
          owner_id: "123e4567-e89b-12d3-a456-426614174000",
          name: "Casa Niebla",
          slug: "casa-niebla",
          description: "Objetos hechos en un taller al pie del volcán.",
          image_path: null,
          imageUrl: null,
          listing_limit: 15,
          time_zone: "America/Mexico_City",
          trust_evaluated_at: null,
          trust_tier: "standard",
          country_code: "MX",
          administrative_area_code: "MX-JAL",
          created_at: "2026-08-19T00:00:00.000Z",
          updated_at: "2026-08-19T00:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByText("Jalisco, México")).toBeInTheDocument();
  });
});
