import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PublicShopCard } from "@/components/catalog/shop-card";

afterEach(cleanup);

describe("PublicShopCard", () => {
  it("replaces a failed decorative shop image without removing its link", () => {
    const { container } = render(
      <PublicShopCard
        shop={{
          id: 2,
          owner_id: "123e4567-e89b-12d3-a456-426614174000",
          name: "Casa Niebla",
          slug: "casa-niebla",
          description: "Objetos hechos en un taller al pie del volcán.",
          image_path: "shops/casa-niebla.jpg",
          imageUrl: "https://example.com/casa-niebla.jpg",
          is_publishing_approved: true,
          publishing_reviewed_at: "2026-08-29T00:00:00.000Z",
          listing_limit: 15,
          time_zone: "America/Mexico_City",
          trust_evaluated_at: null,
          trust_tier: "standard",
          country_code: "MX",
          administrative_area_codes: ["MX-JAL"],
          created_at: "2026-08-19T00:00:00.000Z",
          updated_at: "2026-08-19T00:00:00.000Z",
        }}
      />,
    );

    fireEvent.error(screen.getByRole("presentation"));

    expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
    expect(container.querySelector("svg.lucide-store")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Casa Niebla/ })).toHaveAttribute("href", "/tiendas/casa-niebla");
  });

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
          is_publishing_approved: true,
          publishing_reviewed_at: "2026-08-29T00:00:00.000Z",
          listing_limit: 15,
          time_zone: "America/Mexico_City",
          trust_evaluated_at: null,
          trust_tier: "standard",
          country_code: "MX",
          administrative_area_codes: ["MX-JAL"],
          created_at: "2026-08-19T00:00:00.000Z",
          updated_at: "2026-08-19T00:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByText("Jalisco, México")).toBeInTheDocument();
  });

  it("shows the platform-computed tier without unsupported standard-shop claims", () => {
    render(
      <PublicShopCard
        shop={{
          id: 3,
          owner_id: "123e4567-e89b-12d3-a456-426614174000",
          name: "Taller Volcán",
          slug: "taller-volcan",
          description: "Piezas de barro negro hechas en Oaxaca.",
          image_path: null,
          imageUrl: null,
          is_publishing_approved: true,
          publishing_reviewed_at: "2026-08-29T00:00:00.000Z",
          listing_limit: 15,
          time_zone: "America/Mexico_City",
          trust_evaluated_at: null,
          trust_tier: "standard",
          country_code: "MX",
          administrative_area_codes: ["MX-OAX"],
          created_at: "2026-08-19T00:00:00.000Z",
          updated_at: "2026-08-19T00:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByText("Oaxaca, México")).toBeInTheDocument();
    expect(screen.getByText("Nivel Estándar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Taller Volcán/ }).querySelector("button")).toBeNull();
    expect(screen.queryByText(/verificad|calificaci|reseñas|pedidos|respuesta|envíos|recogida|garantía|protección/i)).not.toBeInTheDocument();
  });
});
