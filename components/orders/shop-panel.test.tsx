import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ShopPanel } from "@/components/orders/shop-panel";

afterEach(cleanup);

const shop = {
  name: "Casa Niebla",
  slug: "casa-niebla",
  imageUrl: null,
  trustTier: "reliable" as const,
  trustMetrics: null,
  locality: "Zapopan",
};

describe("ShopPanel", () => {
  it("names the shop and links to it", () => {
    render(<ShopPanel shop={shop} />);

    expect(screen.getByText("Casa Niebla")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver la tienda" })).toHaveAttribute("href", "/tiendas/casa-niebla");
  });

  it("renders without trust metrics", () => {
    render(<ShopPanel shop={{ ...shop, trustMetrics: null }} />);

    expect(screen.getByText("Zapopan")).toBeInTheDocument();
  });
});
