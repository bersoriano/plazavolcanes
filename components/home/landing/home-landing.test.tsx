import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HomeLanding } from "@/components/home/landing/home-landing";
import { normalizeCatalogFilters } from "@/lib/queries/catalog";

const promo = { active: true };

afterEach(() => {
  cleanup();
  promo.active = true;
});

const article = {
  slug: "cuanto-te-queda",
  title: "Vendiste en $1,000. ¿Cuánto te quedó?",
  description: "La cuenta de una venta, paso a paso.",
  date: "2026-11-05",
  draft: false,
};

function renderLanding(latestPost: typeof article | null = null) {
  render(
    <HomeLanding
      catalog={{
        products: [],
        shops: [],
        categories: [],
        selectedCategory: null,
        selectedSubcategory: null,
        invalidCategorySelection: false,
        searchEventId: null,
      }}
      filters={normalizeCatalogFilters({})}
      founders={{ open: promo.active, taken: null, cap: 100 }}
      latestPost={latestPost}
      stateCounts={[]}
    />,
  );
}

describe("HomeLanding and the founders promotion", () => {
  it("makes the founders offer while the promotion runs", () => {
    renderLanding();

    expect(screen.getByText("Primeras 100 tiendas")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "0% de comisión fija 12 meses." })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Sé de las primeras 100 tiendas." })).toBeInTheDocument();
  });

  it("takes every founders block off the page once it has ended", () => {
    promo.active = false;
    renderLanding();

    expect(screen.queryByText("Primeras 100 tiendas")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3, name: "0% de comisión fija 12 meses." })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Sé de las primeras 100 tiendas." })).not.toBeInTheDocument();
    // The rest of the landing stays.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Tu catálogo listo para compartir por WhatsApp");
    expect(screen.queryByRole("link", { name: "Ver una tienda de ejemplo" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Encuentra productos únicos cerca de ti." })).toBeInTheDocument();
  });
});

describe("HomeLanding and the blog", () => {
  it("briefs the newest post", () => {
    renderLanding(article);

    expect(screen.getByRole("region", { name: article.title })).toBeInTheDocument();
  });

  it("leaves the section out while nothing is published", () => {
    renderLanding(null);

    expect(screen.queryByRole("link", { name: "Leer el artículo" })).not.toBeInTheDocument();
  });
});
