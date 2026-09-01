import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { ProductForm } from "@/components/products/product-form";
import { CategorySuggestionForm } from "@/components/products/category-suggestion-form";
import { createCategorySuggestion } from "@/lib/actions/categories";
import { createProduct } from "@/lib/actions/products";
import { DEFAULT_CATALOG_LOCALE } from "@/lib/catalog-locale";
import { getProductCategoryTree } from "@/lib/queries/categories.server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function NewProductPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) redirect("/panel");
  const { id } = await params;
  const shopId = Number(id);
  if (!Number.isSafeInteger(shopId) || shopId < 1) notFound();
  const supabase = await createServerSupabaseClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const [{ data: shop }, categories] = await Promise.all([
    supabase.from("shops").select("id, name").eq("id", shopId).eq("owner_id", claimsData?.claims?.sub ?? "").maybeSingle(),
    getProductCategoryTree(DEFAULT_CATALOG_LOCALE),
  ]);
  if (!shop) notFound();
  const action = createProduct.bind(null, shopId);

  return <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14"><Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand" href={`/panel/tiendas/${shopId}`}><ArrowLeft aria-hidden="true" className="size-4" />{shop.name}</Link><div className="mt-7 rounded-[2rem] border border-line bg-surface p-6 sm:p-9"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Nuevo producto</p><h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em]">Agrega una publicación</h1><p className="mb-8 mt-3 leading-7 text-muted">Guárdala como borrador o publícala cuando esté lista.</p><ProductForm action={action} categories={categories} /><CategorySuggestionForm action={createCategorySuggestion} categories={categories} /></div></section>;
}
