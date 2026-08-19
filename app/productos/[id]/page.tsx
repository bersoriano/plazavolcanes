import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ImageIcon, Store } from "lucide-react";
import { notFound } from "next/navigation";

import { formatMxn } from "@/lib/format";
import { getPublicProduct } from "@/lib/queries/catalog.server";

function parseProductId(id: string) {
  const value = Number(id);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const productId = parseProductId(id);
  if (!productId) return { title: "Producto no encontrado" };
  const product = await getPublicProduct(productId);
  return product ? { title: product.name, description: product.description } : { title: "Producto no encontrado" };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const productId = parseProductId(id);
  if (!productId) notFound();
  const product = await getPublicProduct(productId);
  if (!product) notFound();

  return <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-brand" href={`/tiendas/${product.shop.slug}`}><ArrowLeft aria-hidden="true" className="size-4" />{product.shop.name}</Link><div className="mt-7 grid gap-8 lg:grid-cols-[1.2fr_.8fr] lg:gap-12"><div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-[#eee8e1]">{product.image_path ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={product.name} className="size-full object-cover" src={product.image_path} />
  ) : <div className="grid size-full place-items-center text-brand/30"><ImageIcon aria-hidden="true" className="size-16" /></div>}</div><div className="flex flex-col justify-center"><Link className="inline-flex w-fit items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-brand-hover" href={`/tiendas/${product.shop.slug}`}><Store aria-hidden="true" className="size-4" />{product.shop.name}</Link><h1 className="mt-5 font-display text-4xl font-semibold leading-tight tracking-[-0.04em] text-ink sm:text-5xl">{product.name}</h1><p className="mt-5 text-3xl font-semibold text-brand">{formatMxn(product.price_mxn)} <span className="text-sm font-medium text-muted">MXN</span></p><div className="my-7 h-px bg-line" /><p className="whitespace-pre-wrap text-base leading-8 text-muted">{product.description}</p><p className="mt-8 rounded-2xl border border-line bg-surface p-4 text-sm leading-6 text-muted">Producto publicado por una tienda independiente de Plaza Volcanes.</p></div></div></section>;
}
