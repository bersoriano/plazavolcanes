import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HomeHero, type HomeHeroListing } from "@/components/home/home-hero";

afterEach(cleanup);

const listing: HomeHeroListing = {
  name: "Micrófono Rode",
  imageUrl: "https://example.supabase.co/storage/v1/object/public/rode.webp",
  price_mxn: 1999,
  currency_code: "MXN",
};

describe("HomeHero", () => {
  it("carries the one buyer message with its kicker, headline and deck", () => {
    render(<HomeHero />);

    expect(screen.getByText("PUBLICA Y ADMINISTRA TUS VENTAS AQUÍ")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Encuentra productos únicos cerca de ti.",
    );
    expect(
      screen.getByText(/Explora artículos nuevos y usados, revisa quién vende/),
    ).toBeInTheDocument();
  });

  it("names its region after the headline", () => {
    render(<HomeHero />);

    expect(
      screen.getByRole("region", { name: "Encuentra productos únicos cerca de ti." }),
    ).toBeInTheDocument();
  });

  it("colours only the closing phrase of the headline", () => {
    render(<HomeHero />);

    const emphasis = screen.getByRole("heading", { level: 1 }).querySelector("em");

    expect(emphasis).toHaveTextContent("cerca de ti.");
    expect(emphasis).toHaveClass("italic", "text-brand");
  });

  it("drops the carousel and the seller pill", () => {
    render(<HomeHero />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/Crea tu tienda y sube/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Construye tu reputación/)).not.toBeInTheDocument();
    expect(
      screen.queryByText("Publicación gratis y sin comisión por artículo vendido"),
    ).not.toBeInTheDocument();
  });

  it("offers the catalogue and the seller landing", () => {
    render(<HomeHero />);

    expect(screen.getByRole("link", { name: "Explorar productos" })).toHaveAttribute(
      "href",
      "#catalogo",
    );
    // Curious intent: the landing explains the offer before signup asks for
    // an account.
    expect(screen.getByRole("link", { name: "Quiero vender" })).toHaveAttribute(
      "href",
      "/vender?desde=hero",
    );
  });

  it("lists the three things a visitor can count on", () => {
    render(<HomeHero />);

    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "No necesitas crear una cuenta para ver los productos.",
      "Pagale directamente a cada tienda",
      "Todo queda por escrito",
    ]);
  });

  it("hides the collage from assistive tech, summarises it and keeps controls out of it", () => {
    render(<HomeHero featured={listing} />);

    const collage = screen.getByTestId("hero-collage");
    expect(collage).toHaveAttribute("aria-hidden", "true");
    expect(collage.querySelectorAll("a, button, input, select, [tabindex]")).toHaveLength(0);
    expect(screen.getByText(/^Ilustración: una compradora/)).toHaveClass("sr-only");
  });

  it("preloads the large photo and stands the cut-out whole in its frame", () => {
    render(<HomeHero />);

    const photos = [...screen.getByTestId("hero-collage").querySelectorAll("img")];
    expect(photos.map((photo) => photo.getAttribute("alt"))).toEqual(["", "", ""]);
    expect(photos[0].src).toContain("herogirl.jpg");
    expect(photos[0]).toHaveClass("object-contain");
    expect(photos[1].src).toContain("new-items.jpg");
    expect(photos[2].src).toContain("used-items.jpg");
    // `preload` is what drops the lazy loading; the two small cards keep it.
    expect(photos[0]).not.toHaveAttribute("loading");
    expect(photos[1]).toHaveAttribute("loading", "lazy");
  });

  it("floats the newest listing with its name and price", () => {
    render(<HomeHero featured={listing} />);

    const card = screen.getByTestId("hero-featured-listing");
    expect(card).toHaveTextContent("Recién publicado");
    expect(card).toHaveTextContent("Micrófono Rode");
    expect(card).toHaveTextContent("$1,999.00");
    expect(card).toHaveTextContent("MXN");
    expect(card.querySelector("img")).toHaveAttribute("src", listing.imageUrl);
  });

  it("leaves the listing card out while the catalogue is empty", () => {
    render(<HomeHero featured={null} />);

    expect(screen.queryByTestId("hero-featured-listing")).not.toBeInTheDocument();
    expect(screen.queryByText("Recién publicado")).not.toBeInTheDocument();
  });
});
