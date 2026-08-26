import { cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProductCard } from "@/components/catalog/product-card";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ProductCard", () => {
  it("shows Nuevo for a new product", () => {
    render(
      <ProductCard
        product={{
          id: 1,
          slug: "producto-1",
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

  it("replaces a failed product image without removing its link", () => {
    const { container } = render(
      <ProductCard
        product={{
          id: 8,
          slug: "taza-volcanica",
          image_path: "https://example.com/taza.jpg",
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

    fireEvent.error(screen.getByRole("img", { name: "Taza volcánica" }));

    expect(screen.queryByRole("img", { name: "Taza volcánica" })).not.toBeInTheDocument();
    expect(container.querySelector("svg.lucide-image")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Taza volcánica/ })).toHaveAttribute("href", "/productos/taza-volcanica");
  });

  it("shows used subcondition instead of a generic used label", () => {
    render(
      <ProductCard
        product={{
          id: 2,
          slug: "producto-2",
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
          slug: "producto-3",
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
          slug: "funda-para-celular",
          category_id: 11,
          condition: "new",
          used_condition: null,
          shop: { name: "Tecno Plaza" },
        }}
      />,
    );

    expect(screen.getByRole("link", { name: /Funda para celular/ })).toHaveAttribute(
      "href",
      "/productos/funda-para-celular?q=iphone&categoria=electronica&subcategoria=celulares-y-accesorios",
    );
  });

  it("carries locale and country to the product and formats currency for that locale", () => {
    render(
      <ProductCard
        catalogHref="/?q=camera&locale=en-US&countryCode=US"
        locale="en-US"
        product={{
          id: 7,
          image_path: null,
          name: "Instant camera",
          slug: "instant-camera",
          price_mxn: 42,
          currency_code: "USD",
          category_id: 11,
          condition: "new",
          used_condition: null,
          shop: { name: "Lava Light" },
        }}
      />,
    );

    expect(screen.getByRole("link", { name: /Instant camera/ })).toHaveAttribute(
      "href",
      "/productos/instant-camera?q=camera&locale=en-US&countryCode=US",
    );
    expect(screen.getByText("$42.00")).toBeInTheDocument();
  });

  it("sends one keepalive selection event when a tracked result is clicked", () => {
    const fetchSpy = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchSpy);

    render(
      <ProductCard
        eventId="1f505b54-3e35-4d7c-9a22-472920dfd72b"
        position={2}
        product={{
          id: 5,
          slug: "producto-5",
          image_path: null,
          name: "Maceta de barro",
          price_mxn: 249,
          currency_code: "MXN",
          category_id: 11,
          condition: "new",
          used_condition: null,
          shop: { name: "Tierra Viva" },
        }}
      />,
    );

    const click = createEvent.click(screen.getByRole("link", { name: /Maceta de barro/ }));
    click.preventDefault();
    fireEvent(screen.getByRole("link", { name: /Maceta de barro/ }), click);

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledWith("/api/search-events/selection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: "1f505b54-3e35-4d7c-9a22-472920dfd72b",
        productId: 5,
        position: 2,
      }),
      keepalive: true,
    });
  });

  it("does not send a selection event when the result is untracked", () => {
    const fetchSpy = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchSpy);

    render(
      <ProductCard
        product={{
          id: 6,
          slug: "producto-6",
          image_path: null,
          name: "Cuenco de piedra",
          price_mxn: 310,
          currency_code: "MXN",
          category_id: 11,
          condition: "new",
          used_condition: null,
          shop: { name: "Taller Cantera" },
        }}
      />,
    );

    const click = createEvent.click(screen.getByRole("link", { name: /Cuenco de piedra/ }));
    click.preventDefault();
    fireEvent(screen.getByRole("link", { name: /Cuenco de piedra/ }), click);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
