import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ShopPanel } from "@/components/orders/shop-panel";

afterEach(cleanup);

const shop = {
  name: "Casa Niebla",
  slug: "casa-niebla",
  imageUrl: "/casa-niebla.jpg",
  trustTier: "reliable" as const,
  trustMetrics: {
    averageReplyTimeMinutes: 45,
    responseRate: 98,
    descriptionAccuracy: 97,
    onTimeShippingRate: 96,
    orderCompletionRate: 99,
    disputeRate: 0,
    totalOrders: 32,
    averageRating: 4.8,
    reviewCount: 20,
    lastActiveDaysAgo: 1,
    sellerActiveDaysAgo: 1,
    evaluatedAt: "2026-08-27T12:00:00Z",
  },
  trustProfile: { joinedOn: "2025-01-15" },
  sellerDisplayName: "Elena Volcán",
  location: "Jalisco, México",
};

describe("ShopPanel", () => {
  it("names the shop and links to it", () => {
    render(<ShopPanel shop={shop} />);

    expect(screen.getByText("Casa Niebla")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver la tienda" })).toHaveAttribute("href", "/tiendas/casa-niebla");
  });

  it("shows the seller, stored location, image, tier and positive trust evidence", () => {
    render(<ShopPanel shop={shop} />);

    expect(screen.getByText("Elena Volcán")).toBeInTheDocument();
    expect(screen.getByText("Jalisco, México")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Casa Niebla" })).toHaveAttribute(
      "src",
      "/casa-niebla.jpg",
    );
    expect(screen.getByText("Nivel Confiable")).toBeInTheDocument();
    expect(screen.getByTestId("trust-badge-membership")).toHaveAttribute(
      "data-state",
      "measured",
    );
    expect(screen.getByTestId("trust-badge-response_rate")).toHaveTextContent("98%");
  });

  it("renders the trust vocabulary even before metrics accumulate", () => {
    render(<ShopPanel shop={{ ...shop, trustMetrics: null, trustProfile: null }} />);

    expect(screen.getByLabelText("Marcadores de confianza")).toBeInTheDocument();
  });
});
