import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { ProductForm } from "@/components/products/product-form";
import { getSellerPublicationState } from "@/components/products/product-row";
import { ProductTranslationForm } from "@/components/products/product-translation-form";
import { CategorySuggestionForm } from "@/components/products/category-suggestion-form";
import { createCategorySuggestion } from "@/lib/actions/categories";
import { removeProductImage, updateProduct } from "@/lib/actions/products";
import { saveEnglishProductTranslation } from "@/lib/actions/product-translations";
import { DEFAULT_CATALOG_LOCALE } from "@/lib/catalog-locale";
import { getProductCategoryTree } from "@/lib/queries/categories.server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MEDIA_VARIANTS, mediaUrls } from "@/lib/media/url";

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ categoria?: string | string[]; limite?: string | string[] }> }) {
  if (!isSupabaseConfigured()) redirect("/panel");
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isSafeInteger(productId) || productId < 1) notFound();
  const supabase = await createServerSupabaseClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const { data: product } = await supabase.from("products").select("*").eq("id", productId).maybeSingle();
  // A retired listing is kept only so its conversations still have something to
  // point at. It is not editable, and it reads as gone.
  if (!product || product.status === "deleted") notFound();
  const { data: galleryRows } = await supabase
    .from("product_images")
    .select("id, storage_path, position")
    .eq("product_id", productId)
    .order("position");
  const { data: shop } = await supabase.from("shops").select("id, name, is_publishing_approved, publishing_reviewed_at").eq("id", product.shop_id).eq("owner_id", claimsData?.claims?.sub ?? "").maybeSingle();
  if (!shop) notFound();
  const imageUrls = mediaUrls([product.image_path, ...(galleryRows ?? []).map((image) => image.storage_path)], MEDIA_VARIANTS.thumbnail);
  const galleryImages = (galleryRows ?? []).map((image) => ({
    id: image.id,
    url: imageUrls.get(image.storage_path) ?? null,
    position: image.position,
  }));
  const [categories, query, translationResult] = await Promise.all([
    getProductCategoryTree(DEFAULT_CATALOG_LOCALE, { includeInactive: true }),
    searchParams,
    supabase
      .from("product_translations")
      .select("name, description")
      .eq("product_id", productId)
      .eq("locale", "en-US")
      .maybeSingle(),
  ]);
  const categoryRequired = query.categoria === "requerida=1";
  const listingLimitReached = query.limite === "alcanzado";
  const action = updateProduct.bind(null, productId);
  const removeImageAction = removeProductImage.bind(null, productId);
  const translationAction = saveEnglishProductTranslation.bind(null, productId);
  const publicationState = getSellerPublicationState({
    status: product.status,
    expires_at: product.expires_at,
    is_admin_enabled: product.is_admin_enabled,
    is_publishing_approved: shop.is_publishing_approved,
    publishing_reviewed_at: shop.publishing_reviewed_at,
  });

  return <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14"><div className="flex items-center justify-between gap-4"><Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand" href={`/panel/tiendas/${shop.id}`}><ArrowLeft aria-hidden="true" className="size-4" />{shop.name}</Link>{publicationState.isPublic ? <Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand" href={`/productos/${product.slug}`}><ExternalLink aria-hidden="true" className="size-4" />Ver publicación</Link> : null}</div><div className="mt-7 rounded-[2rem] border border-line bg-surface p-6 sm:p-9"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">{publicationState.label}</p><h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em]">Edita tu producto</h1><p className="mb-8 mt-3 leading-7 text-muted">Los cambios publicados aparecerán inmediatamente en la plaza.</p>{categoryRequired ? <p className="mb-6 rounded-2xl bg-sale/10 px-4 py-3 text-sm font-medium text-sale" role="alert">Selecciona una subcategoría válida antes de publicar.</p> : null}{listingLimitReached ? <p className="mb-6 rounded-2xl bg-sale/10 px-4 py-3 text-sm font-medium text-sale" role="alert">Alcanzaste el límite de publicaciones activas de tu tienda.</p> : null}<ProductForm action={action} categories={categories} product={{ name: product.name, description: product.description, price_mxn: product.price_mxn, status: product.status === "expired" ? "draft" : product.status, condition: product.condition, used_condition: product.used_condition, category_id: product.category_id, handling_days: product.handling_days, units_available: product.units_available, imageUrl: product.image_path ? (imageUrls.get(product.image_path) ?? null) : null }} images={galleryImages} productId={product.id} shopId={shop.id} removeImageAction={removeImageAction} /><ProductTranslationForm action={translationAction} translation={translationResult.data} /><CategorySuggestionForm action={createCategorySuggestion} categories={categories} /></div></section>;
}
