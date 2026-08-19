import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { ProductForm } from "@/components/products/product-form";
import { CategorySuggestionForm } from "@/components/products/category-suggestion-form";
import { createCategorySuggestion } from "@/lib/actions/categories";
import { updateProduct } from "@/lib/actions/products";
import { DEFAULT_CATALOG_LOCALE } from "@/lib/catalog-locale";
import { getProductCategoryTree } from "@/lib/queries/categories.server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCatalogImageUrl } from "@/lib/storage";

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ categoria?: string | string[] }> }) {
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
  const [categories, query] = await Promise.all([
    getProductCategoryTree(DEFAULT_CATALOG_LOCALE, { includeInactive: true }),
    searchParams,
  ]);
  const categoryRequired = query.categoria === "requerida=1";
  const action = updateProduct.bind(null, productId);

  return <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14"><div className="flex items-center justify-between gap-4"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-brand" href={`/panel/tiendas/${shop.id}`}><ArrowLeft aria-hidden="true" className="size-4" />{shop.name}</Link>{product.status === "published" ? <Link className="inline-flex items-center gap-2 text-sm font-semibold text-brand" href={`/productos/${product.id}`}><ExternalLink aria-hidden="true" className="size-4" />Ver publicación</Link> : null}</div><div className="mt-7 rounded-[2rem] border border-line bg-surface p-6 sm:p-9"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">{product.status === "published" ? "Producto publicado" : "Borrador"}</p><h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em]">Edita tu producto</h1><p className="mb-8 mt-3 leading-7 text-muted">Los cambios publicados aparecerán inmediatamente en la plaza.</p>{categoryRequired ? <p className="mb-6 rounded-2xl bg-sale/10 px-4 py-3 text-sm font-medium text-sale" role="alert">Selecciona una subcategoría válida antes de publicar.</p> : null}<ProductForm action={action} categories={categories} product={{ name: product.name, description: product.description, price_mxn: product.price_mxn, status: product.status, condition: product.condition, used_condition: product.used_condition, category_id: product.category_id, imageUrl: getCatalogImageUrl(product.image_path) }} /><CategorySuggestionForm action={createCategorySuggestion} categories={categories} /></div></section>;
}
