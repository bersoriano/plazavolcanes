import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductCard } from "@/components/catalog/product-card";

describe("ProductCard", () => {
  it("shows Nuevo for a new product", () => {
    render(
      <ProductCard
        product={{
          id: 1,
          image_path: null,
          name: "Taza volcánica",
          price_mxn: 349,
          condition: "new",
          used_condition: null,
          shop: { name: "Casa Niebla" },
        }}
      />,
    );

    expect(screen.getByText("Nuevo")).toBeInTheDocument();
  });

  it("shows used subcondition instead of a generic used label", () => {
    render(
      <ProductCard
        product={{
          id: 2,
          image_path: null,
          name: "Lámpara antigua",
          price_mxn: 890,
          condition: "used",
          used_condition: "fair",
          shop: { name: "Segunda Vida" },
        }}
      />,
    );

    expect(screen.getByText("Usado · Aceptable")).toBeInTheDocument();
  });
});
