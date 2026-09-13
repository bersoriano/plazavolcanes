import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildProductJsonLd, buildProductMetadata, type ProductSeoInput } from "@/lib/seo/product-metadata";

const product: ProductSeoInput = {
  slug: "taza-de-barro",
  name: "Taza de barro",
  description: "Taza hecha a mano en Tlaquepaque.\n\nCapacidad de 300 ml.",
  price_mxn: 250,
  currency_code: "MXN",
  units_available: 3,
  condition: "new",
  used_condition: null,
  images: ["https://cdn.example/taza-1.jpg", "https://cdn.example/taza-2.jpg"],
  shop: { name: "Casa Niebla", slug: "casa-niebla" },
};

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://plazavolcanes.com"));
afterEach(() => vi.unstubAllEnvs());

describe("product metadata", () => {
  it("names the product, its condition and the plaza", () => {
    expect(buildProductMetadata(product).title).toEqual({ absolute: "Taza de barro (Nuevo) | Plaza Volcanes" });
    expect(
      buildProductMetadata({ ...product, condition: "used", used_condition: "good" }).title,
    ).toEqual({ absolute: "Taza de barro (Usado · Buen estado) | Plaza Volcanes" });
  });

  it("leads the description with price, condition and shop, then the seller's words on one line", () => {
    expect(buildProductMetadata(product).description).toBe(
      "$250.00 MXN · Nuevo · Vendido por Casa Niebla en Plaza Volcanes. Taza hecha a mano en Tlaquepaque. Capacidad de 300 ml.",
    );
  });

  it("cuts a long description at a word, within 160 characters", () => {
    const sellerWords = "Barro bruñido ".repeat(40).trim();
    const full = `$250.00 MXN · Nuevo · Vendido por Casa Niebla en Plaza Volcanes. ${sellerWords}`;
    const description = buildProductMetadata({ ...product, description: sellerWords }).description as string;
    const kept = description.slice(0, -1);

    expect(description.length).toBeLessThanOrEqual(160);
    expect(description.endsWith("…")).toBe(true);
    expect(full.startsWith(kept)).toBe(true);
    // The cut falls between words, never inside one.
    expect(full[kept.length]).toBe(" ");
  });

  it("gives every variant of the page one canonical address", () => {
    const metadata = buildProductMetadata(product);

    expect(metadata.alternates?.canonical).toBe("/productos/taza-de-barro");
    expect(metadata.openGraph).toMatchObject({
      type: "website",
      locale: "es_MX",
      siteName: "Plaza Volcanes",
      url: "/productos/taza-de-barro",
      title: "Taza de barro (Nuevo) | Plaza Volcanes",
    });
  });

  it("shares the product's first photo", () => {
    const metadata = buildProductMetadata(product);

    expect(metadata.openGraph?.images).toEqual([{ url: "https://cdn.example/taza-1.jpg", alt: "Taza de barro" }]);
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image", images: ["https://cdn.example/taza-1.jpg"] });
  });

  it("leaves the plaza's card in place when there is no photo", () => {
    const metadata = buildProductMetadata({ ...product, images: [] });

    expect(metadata.openGraph).not.toHaveProperty("images");
    expect(metadata.twitter).not.toHaveProperty("images");
  });
});

describe("product structured data", () => {
  const breadcrumb = {
    category: { name: "Hogar y jardín", slug: "hogar-y-jardin" },
    subcategory: { name: "Cocina", slug: "cocina" },
  };

  function graph(input = product, crumbs: Parameters<typeof buildProductJsonLd>[1] = breadcrumb) {
    const data = buildProductJsonLd(input, crumbs);
    expect(data["@context"]).toBe("https://schema.org");
    return data["@graph"];
  }

  it("describes the product and the offer a buyer can make", () => {
    const [item] = graph();

    expect(item).toEqual({
      "@type": "Product",
      name: "Taza de barro",
      description: "Taza hecha a mano en Tlaquepaque.\n\nCapacidad de 300 ml.",
      image: ["https://cdn.example/taza-1.jpg", "https://cdn.example/taza-2.jpg"],
      sku: "taza-de-barro",
      category: "Hogar y jardín > Cocina",
      offers: {
        "@type": "Offer",
        url: "https://plazavolcanes.com/productos/taza-de-barro",
        price: "250.00",
        priceCurrency: "MXN",
        availability: "https://schema.org/InStock",
        itemCondition: "https://schema.org/NewCondition",
        seller: { "@type": "Organization", name: "Casa Niebla", url: "https://plazavolcanes.com/tiendas/casa-niebla" },
      },
    });
  });

  it("says when a product is used or has run out", () => {
    const [item] = graph({ ...product, condition: "used", used_condition: "fair", units_available: 0 });

    expect(item.offers).toMatchObject({
      availability: "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/UsedCondition",
    });
  });

  it("keeps at most five photos and omits a missing image or category", () => {
    const many = Array.from({ length: 7 }, (_, index) => `https://cdn.example/${index}.jpg`);

    expect(graph({ ...product, images: many })[0].image).toHaveLength(5);

    const [bare] = graph({ ...product, images: [] }, {});
    expect(bare).not.toHaveProperty("image");
    expect(bare).not.toHaveProperty("category");
  });

  it("walks the breadcrumb from the plaza down to the product, skipping missing levels", () => {
    expect(graph()[1]).toEqual({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Plaza Volcanes", item: "https://plazavolcanes.com/" },
        { "@type": "ListItem", position: 2, name: "Hogar y jardín", item: "https://plazavolcanes.com/?categoria=hogar-y-jardin" },
        {
          "@type": "ListItem",
          position: 3,
          name: "Cocina",
          item: "https://plazavolcanes.com/?categoria=hogar-y-jardin&subcategoria=cocina",
        },
        { "@type": "ListItem", position: 4, name: "Taza de barro", item: "https://plazavolcanes.com/productos/taza-de-barro" },
      ],
    });

    expect(graph(product, {})[1].itemListElement.map((entry: { name: string }) => entry.name)).toEqual([
      "Plaza Volcanes",
      "Taza de barro",
    ]);
  });
});
