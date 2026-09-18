import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ShopPanel } from "@/components/orders/shop-panel";

afterEach(cleanup);

const shop = {
  name: "Casa Niebla",
  slug: "casa-niebla",
  imageUrl: "/casa-niebla.jpg",
  isPremium: false,
  trustTier: "reliable" as const,
  trustMetrics: {
    status: "ready" as const,
    metrics: {
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

  it("shows the seller, stored location, image and the history they earned", () => {
    render(<ShopPanel shop={shop} />);

    expect(screen.getByText("Elena Volcán")).toBeInTheDocument();
    expect(screen.getByText("Jalisco, México")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Casa Niebla" })).toHaveAttribute(
      "src",
      "/casa-niebla.jpg",
    );
    expect(screen.getByTestId("reputation-badge")).toHaveTextContent("Confiable");
    expect(screen.getByTestId("selling-history")).toHaveTextContent(
      "32 pedidos completados · 4.8 de 5 en 20 reseñas",
    );
  });

  it("states the same standing here as on the storefront for a premium shop", () => {
    render(<ShopPanel shop={{ ...shop, isPremium: true }} />);

    expect(screen.getByTestId("premium-badge")).toHaveTextContent("Premium");
    expect(screen.getByTestId("premium-note")).toHaveTextContent(
      "Distinción otorgada por Plaza Volcanes.",
    );
  });

  it("shows no earned tier for a shop still in the starting tier", () => {
    render(<ShopPanel shop={{ ...shop, trustTier: "standard" }} />);

    expect(screen.queryByTestId("reputation-badge")).toBeNull();
    expect(screen.queryByText(/Estándar/)).toBeNull();
  });

  it("says a shop is building its history rather than showing empty metrics", () => {
    render(
      <ShopPanel
        shop={{ ...shop, trustMetrics: { status: "pending" }, trustProfile: null }}
      />,
    );

    expect(screen.getByTestId("selling-history")).toHaveTextContent(
      "está construyendo su historial",
    );
    expect(screen.queryByLabelText("Marcadores de confianza")).toBeNull();
  });
});
