import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MapPin, Store } from "lucide-react";
import { notFound } from "next/navigation";

import { ProductCard } from "@/components/catalog/product-card";
import { ProductGrid } from "@/components/catalog/product-grid";
import { ShareActions } from "@/components/share/share-actions";
import { EmptyState } from "@/components/ui/empty-state";
import { getPublicShop } from "@/lib/queries/catalog.server";
import { formatShopLocation } from "@/lib/shop-location";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getPublicShop(slug);
  return shop ? { title: shop.name, description: shop.description } : { title: "Tienda no encontrada" };
}

export default async function PublicShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await getPublicShop(slug);
  if (!shop) notFound();

  return <section className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8 sm:py-14 lg:px-12"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-brand" href="/"><ArrowLeft aria-hidden="true" className="size-4" />Volver a la plaza</Link><div className="mt-7 overflow-hidden rounded-[2rem] border border-line bg-surface"><div className="grid md:grid-cols-[minmax(280px,.75fr)_1.25fr]"> <div className="aspect-[16/10] bg-[#eee8e1] md:aspect-auto">{shop.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" className="size-full object-cover" src={shop.imageUrl} />
  ) : <div className="grid size-full min-h-64 place-items-center text-brand/30"><Store aria-hidden="true" className="size-14" /></div>}</div><div className="flex flex-col justify-center p-7 sm:p-10"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Tienda independiente</p><h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{shop.name}</h1><p className="mt-3 flex items-center gap-2 text-sm font-semibold text-brand"><MapPin aria-hidden="true" className="size-4" />{formatShopLocation(shop.country_code, shop.administrative_area_code)}</p><p className="mt-4 max-w-2xl text-base leading-8 text-muted">{shop.description}</p><div className="mt-6"><ShareActions label="Compartir tienda" title={shop.name} /></div></div></div></div><div className="mb-7 mt-12"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Escaparate</p><h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em]">Productos publicados</h2></div><ProductGrid>{shop.products.length ? shop.products.map((product) => <ProductCard key={product.id} product={product} />) : <EmptyState icon={<Store aria-hidden="true" className="size-7" />} title="Esta tienda prepara su catálogo" description="Vuelve pronto para descubrir sus productos." />}</ProductGrid></section>;
}
