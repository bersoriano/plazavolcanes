import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { ProductForm } from "@/components/products/product-form";
import { updateProduct } from "@/lib/actions/products";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCatalogImageUrl } from "@/lib/storage";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) redirect("/panel");
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isSafeInteger(productId) || productId < 1) notFound();
  const supabase = await createServerSupabaseClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const { data: product } = await supabase.from("products").select("*").eq("id", productId).maybeSingle();
  if (!product) notFound();
  const { data: shop } = await supabase.from("shops").select("id, name").eq("id", product.shop_id).eq("owner_id", claimsData?.claims?.sub ?? "").maybeSingle();
  if (!shop) notFound();
  const action = updateProduct.bind(null, productId);

  return <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14"><div className="flex items-center justify-between gap-4"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-brand" href={`/panel/tiendas/${shop.id}`}><ArrowLeft aria-hidden="true" className="size-4" />{shop.name}</Link>{product.status === "published" ? <Link className="inline-flex items-center gap-2 text-sm font-semibold text-brand" href={`/productos/${product.id}`}><ExternalLink aria-hidden="true" className="size-4" />Ver publicación</Link> : null}</div><div className="mt-7 rounded-[2rem] border border-line bg-surface p-6 sm:p-9"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">{product.status === "published" ? "Producto publicado" : "Borrador"}</p><h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em]">Edita tu producto</h1><p className="mb-8 mt-3 leading-7 text-muted">Los cambios publicados aparecerán inmediatamente en la plaza.</p><ProductForm action={action} product={{ name: product.name, description: product.description, price_mxn: product.price_mxn, status: product.status, imageUrl: getCatalogImageUrl(product.image_path) }} /></div></section>;
}
