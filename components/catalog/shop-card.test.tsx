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
          delivery_policy: null,
          delivery_policy_updated_at: null,
          description: "Objetos hechos en un taller al pie del volcán.",
          image_path: "shops/casa-niebla.jpg",
          imageUrl: "https://example.com/casa-niebla.jpg",
          is_publishing_approved: true,
          is_premium: false,
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
          delivery_policy: null,
          delivery_policy_updated_at: null,
          description: "Objetos hechos en un taller al pie del volcán.",
          image_path: null,
          imageUrl: null,
          is_publishing_approved: true,
          is_premium: false,
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
          delivery_policy: null,
          delivery_policy_updated_at: null,
          description: "Piezas de barro negro hechas en Oaxaca.",
          image_path: null,
          imageUrl: null,
          is_publishing_approved: true,
          is_premium: false,
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
    // The starting tier is an operational level, not a public rank.
    expect(screen.queryByText(/Nivel Estándar/)).toBeNull();
    expect(screen.queryByTestId("reputation-badge")).toBeNull();
    expect(screen.getByRole("link", { name: /Taller Volcán/ }).querySelector("button")).toBeNull();
    expect(screen.queryByText(/verificad|calificaci|reseñas|pedidos|respuesta|envíos|recogida|garantía|protección/i)).not.toBeInTheDocument();
  });

  it("marks a distinguished shop with the premium chip and gold border", () => {
    render(
      <PublicShopCard
        shop={{
          id: 4,
          owner_id: "123e4567-e89b-12d3-a456-426614174000",
          name: "Casa Premium",
          slug: "casa-premium",
          delivery_policy: null,
          delivery_policy_updated_at: null,
          description: "Piezas seleccionadas por el equipo de Plaza Volcanes.",
          image_path: null,
          imageUrl: null,
          is_publishing_approved: true,
          is_premium: true,
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

    expect(screen.getByText("Premium")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Casa Premium/ })).toHaveClass("border-premium-gold");
    // The same deeper gold ink the product card gives a distinguished shop's name.
    expect(screen.getByRole("heading", { name: "Casa Premium" })).toHaveClass(
      "font-semibold",
      "text-premium-text",
    );
  });

  it("leaves an ordinary shop unmarked", () => {
    render(
      <PublicShopCard
        shop={{
          id: 5,
          owner_id: "123e4567-e89b-12d3-a456-426614174000",
          name: "Casa Niebla",
          slug: "casa-niebla-2",
          delivery_policy: null,
          delivery_policy_updated_at: null,
          description: "Objetos hechos en un taller al pie del volcán.",
          image_path: null,
          imageUrl: null,
          is_publishing_approved: true,
          is_premium: false,
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

    expect(screen.queryByText("Premium")).toBeNull();
    expect(screen.getByRole("link", { name: /Casa Niebla/ })).toHaveClass("border-line");
    expect(screen.getByRole("heading", { name: "Casa Niebla" })).not.toHaveClass("text-premium-text");
  });
});
