import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProductCard } from "@/components/catalog/product-card";

afterEach(cleanup);

describe("ProductCard", () => {
  it("shows Nuevo for a new product", () => {
    render(
      <ProductCard
        product={{
          id: 1,
          image_path: null,
          name: "Taza volcánica",
          price_mxn: 349,
          currency_code: "MXN",
          category_id: 11,
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
          currency_code: "MXN",
          category_id: 12,
          condition: "used",
          used_condition: "fair",
          shop: { name: "Segunda Vida" },
        }}
      />,
    );

    expect(screen.getByText("Usado · Aceptable")).toBeInTheDocument();
  });

  it("shows the product currency and category supplied by the catalog", () => {
    render(
      <ProductCard
        categoryName="Electrónica"
        product={{
          id: 3,
          image_path: null,
          name: "Cámara instantánea",
          price_mxn: 42,
          currency_code: "USD",
          category_id: 11,
          condition: "used",
          used_condition: "good",
          shop: { name: "Luz de lava" },
        }}
      />,
    );

    expect(screen.getByText("Electrónica")).toBeInTheDocument();
    expect(screen.getByText("USD")).toBeInTheDocument();
    expect(screen.queryByText("MXN")).not.toBeInTheDocument();
  });

  it("carries catalog filters to the product URL", () => {
    render(
      <ProductCard
        catalogHref="/?q=iphone&categoria=electronica&subcategoria=celulares-y-accesorios"
        product={{
          id: 4,
          image_path: null,
          name: "Funda para celular",
          price_mxn: 199,
          currency_code: "MXN",
          category_id: 11,
          condition: "new",
          used_condition: null,
          shop: { name: "Tecno Plaza" },
        }}
      />,
    );

    expect(screen.getByRole("link", { name: /Funda para celular/ })).toHaveAttribute(
      "href",
      "/productos/4?q=iphone&categoria=electronica&subcategoria=celulares-y-accesorios",
    );
  });
});
