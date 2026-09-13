import { describe, expect, it } from "vitest";

import { resolveCategorySelection, type CategoryTree } from "@/lib/categories";
import { normalizeCatalogFilters } from "@/lib/queries/catalog";
import { buildHomeMetadata } from "@/lib/seo/home-metadata";

const tree: CategoryTree[] = [
  {
    id: 1,
    parentId: null,
    slug: "electronica",
    name: "Electrónica",
    sortOrder: 1,
    isActive: true,
    children: [
      { id: 11, parentId: 1, slug: "celulares", name: "Celulares y accesorios", sortOrder: 1, isActive: true },
    ],
  },
];

function metadataFor(params: Parameters<typeof normalizeCatalogFilters>[0], listed = true) {
  const filters = normalizeCatalogFilters(params);
  return buildHomeMetadata({ filters, selection: resolveCategorySelection(tree, filters), listed });
}

describe("home metadata", () => {
  it("names the plaza and what it offers on the bare home page", () => {
    const metadata = metadataFor({});

    expect(metadata.title).toEqual({ absolute: "Plaza Volcanes: tiendas independientes de México" });
    expect(metadata.description).toMatch(/tiendas independientes de todo México/);
    expect(metadata.alternates?.canonical).toBe("/");
    expect(metadata.robots).toBeUndefined();
    expect(metadata.openGraph).toMatchObject({
      type: "website",
      locale: "es_MX",
      siteName: "Plaza Volcanes",
      url: "/",
      title: "Plaza Volcanes: tiendas independientes de México",
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("turns a category with listings into its own landing page", () => {
    const metadata = metadataFor({ categoria: "electronica" });

    expect(metadata.title).toEqual({ absolute: "Electrónica: productos de tiendas independientes | Plaza Volcanes" });
    expect(metadata.description).toMatch(/productos de Electrónica/);
    expect(metadata.alternates?.canonical).toBe("/?categoria=electronica");
    expect(metadata.robots).toBeUndefined();
    expect(metadata.openGraph).toMatchObject({
      url: "/?categoria=electronica",
      title: "Electrónica: productos de tiendas independientes | Plaza Volcanes",
    });
  });

  it("turns a subcategory into its own landing page, naming its parent", () => {
    const metadata = metadataFor({ categoria: "electronica", subcategoria: "celulares" });

    expect(metadata.title).toEqual({ absolute: "Celulares y accesorios: productos de tiendas independientes | Plaza Volcanes" });
    expect(metadata.description).toMatch(/Celulares y accesorios \(Electrónica\)/);
    expect(metadata.alternates?.canonical).toBe("/?categoria=electronica&subcategoria=celulares");
  });

  it("keeps a category with nothing published out of the index", () => {
    const metadata = metadataFor({ categoria: "electronica" }, false);

    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toBe("/?categoria=electronica");
  });

  it("keeps a category it does not know out of the index", () => {
    for (const params of [{ categoria: "inventada" }, { categoria: "electronica", subcategoria: "otra" }, { subcategoria: "celulares" }]) {
      const metadata = metadataFor(params);

      expect(metadata.robots).toEqual({ index: false, follow: true });
      expect(metadata.alternates?.canonical).toBeUndefined();
    }
  });

  it("keeps search results out of the index, even inside a category", () => {
    const metadata = metadataFor({ q: "taza", categoria: "electronica" });

    expect(metadata.title).toEqual({ absolute: "Resultados para “taza” | Plaza Volcanes" });
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toBeUndefined();
    expect(metadata.openGraph).not.toHaveProperty("url");
  });

  it("points locale and market variants at the default page", () => {
    expect(metadataFor({ locale: "en-US" }).alternates?.canonical).toBe("/");
    expect(metadataFor({ categoria: "electronica", countryCode: "US" }).alternates?.canonical).toBe(
      "/?categoria=electronica",
    );
  });
});
