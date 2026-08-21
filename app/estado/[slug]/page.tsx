import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatalogScreen } from "@/components/catalog/catalog-screen";
import { normalizeCatalogFilters } from "@/lib/queries/catalog";
import { getHomeCatalog } from "@/lib/queries/catalog.server";
import { findAdministrativeAreaBySlug } from "@/lib/shop-location";

type StateParams = Promise<{ slug: string }>;

type StateSearchParams = Promise<{
  q?: string | string[];
  categoria?: string | string[];
  subcategoria?: string | string[];
  locale?: string | string[];
  countryCode?: string | string[];
}>;

export async function generateMetadata({
  params,
}: {
  params: StateParams;
}): Promise<Metadata> {
  const area = findAdministrativeAreaBySlug((await params).slug);

  if (!area) return { title: "Estado no disponible — Plaza Volcanes" };

  return {
    title: `Productos en ${area.label} — Plaza Volcanes`,
    description: `Descubre productos de tiendas independientes que operan en ${area.label}.`,
  };
}

export default async function StatePage({
  params,
  searchParams,
}: {
  params: StateParams;
  searchParams: StateSearchParams;
}) {
  const { slug } = await params;
  const area = findAdministrativeAreaBySlug(slug);

  if (!area) notFound();

  const filters = normalizeCatalogFilters({ ...(await searchParams), estado: slug });
  const catalog = await getHomeCatalog(filters);

  return <CatalogScreen area={area} catalog={catalog} filters={filters} />;
}
