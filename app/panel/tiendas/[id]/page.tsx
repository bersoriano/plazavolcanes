import Link from "next/link";
import { ArrowLeft, ChevronDown, ExternalLink, PackageOpen, Plus, Trash2 } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { DeliveryPolicyForm } from "@/components/shops/delivery-policy-form";
import { ShopForm } from "@/components/shops/shop-form";
import { TrustDashboardCard } from "@/components/shops/trust-dashboard-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductRow } from "@/components/products/product-row";
import type { ListingStatus } from "@/components/ui/status-badge";
import { deleteShop, updateDeliveryPolicy, updateShop } from "@/lib/actions/shops";
import {
  deliveryPolicyUnlocksAt,
  isDeliveryPolicyEditable,
} from "@/lib/delivery-policy";
import { getShopTrustDashboard } from "@/lib/queries/trust.server";
import { PICKUP_POINT_READ_ERROR } from "@/lib/queries/checkout";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mediaUrls } from "@/lib/media/url";

export default async function ShopManagePage({ params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) redirect("/panel");
  const { id } = await params;
  const shopId = Number(id);
  if (!Number.isSafeInteger(shopId) || shopId < 1) notFound();

  const supabase = await createServerSupabaseClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  const { data: shop } = await supabase.from("shops").select("*").eq("id", shopId).eq("owner_id", userId ?? "").maybeSingle();
  if (!shop) notFound();
  const { data: pickupPoint, error: pickupPointError } = await supabase
    .from("shop_pickup_points")
    .select("address_line1, locality, administrative_area_code, postal_code, notes")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (pickupPointError) throw new Error(PICKUP_POINT_READ_ERROR);
  const { data: products } = await supabase.from("products").select("id, name, price_mxn, image_path, status, expires_at, is_admin_enabled").eq("shop_id", shopId).neq("status", "deleted").order("created_at", { ascending: false });
  // Retired listings are kept only so their conversations still have something to
  // point at, and the query above leaves them out; narrowing here says so in types.
  const listings = (products ?? []).filter(
    (product): product is typeof product & { status: ListingStatus } => product.status !== "deleted",
  );
  const imageUrls = mediaUrls([
    shop.image_path,
    ...listings.map((product) => product.image_path),
  ]);
  const trustDashboard = await getShopTrustDashboard(shopId);
  const updateAction = updateShop.bind(null, shopId);
  const deleteAction = deleteShop.bind(null, shopId);
  const deliveryPolicyAction = updateDeliveryPolicy.bind(null, shopId);
  // The database decides this, and refuses a change either way; the panel reads
  // the same clock so the seller sees a shut field instead of a rejected save.
  const deliveryPolicyUnlocksOn = isDeliveryPolicyEditable(shop.delivery_policy_updated_at)
    ? null
    : (deliveryPolicyUnlocksAt(shop.delivery_policy_updated_at)?.toISOString() ?? null);

  return (
    <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4"><Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand" href="/panel"><ArrowLeft aria-hidden="true" className="size-4" />Mis tiendas</Link><Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand" href={`/tiendas/${shop.slug}`}><ExternalLink aria-hidden="true" className="size-4" />Ver tienda pública</Link></div>
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Tu tienda</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{shop.name}</h1>
      {trustDashboard ? <div className="mt-7"><TrustDashboardCard dashboard={trustDashboard} /></div> : null}
      {/* The catalogue leads: adding and checking listings is the daily errand
          here, while the shop's own details are edited once in a while. */}
      <div className="mt-7 grid items-start gap-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,.95fr)]">
        <section aria-labelledby="catalogo-title" className="rounded-[2rem] border border-line bg-surface p-6 sm:p-8"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Catálogo</p><h2 className="mt-1 font-display text-2xl font-semibold" id="catalogo-title">Productos</h2></div><Link className="grid size-11 place-items-center rounded-full bg-brand text-white" href={`/panel/tiendas/${shopId}/productos/nuevo`} aria-label="Agregar producto"><Plus aria-hidden="true" className="size-5" /></Link></div>
          {listings.length ? <ul className="mt-6 divide-y divide-line">{listings.map((product) => <ProductRow key={product.id} product={{ ...product, image_url: product.image_path ? (imageUrls.get(product.image_path) ?? null) : null, is_publishing_approved: shop.is_publishing_approved, publishing_reviewed_at: shop.publishing_reviewed_at }} />)}</ul> : <div className="mt-6"><EmptyState icon={<PackageOpen aria-hidden="true" className="size-7" />} title="Catálogo vacío" description="Agrega tu primer producto como borrador." action={<Link className="inline-flex min-h-11 items-center font-semibold text-brand underline decoration-accent decoration-4 underline-offset-4" href={`/panel/tiendas/${shopId}/productos/nuevo`}>Agregar producto</Link>} /></div>}
        </section>
        {/* Folded away on a phone so it never buries the catalogue, and simply
            open on a wide screen, where there is room for both at once. */}
        <details className="disclosure-mobile group rounded-[2rem] border border-line bg-surface p-6 sm:p-8">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 lg:cursor-default [&::-webkit-details-marker]:hidden"><span><span className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Ajustes</span><h2 className="mt-1 font-display text-2xl font-semibold">Editar tienda</h2></span><ChevronDown aria-hidden="true" className="size-5 shrink-0 text-brand transition-transform group-open:rotate-180 lg:hidden" /></summary>
          <p className="mb-7 mt-2 text-muted">Mantén clara la historia de tu tienda.</p><ShopForm action={updateAction} shop={{ name: shop.name, description: shop.description, imageUrl: shop.image_path ? (imageUrls.get(shop.image_path) ?? null) : null, countryCode: shop.country_code, administrativeAreaCodes: shop.administrative_area_codes ?? [] }} pickupPoint={pickupPoint ? {
            addressLine1: pickupPoint.address_line1,
            locality: pickupPoint.locality,
            administrativeAreaCode: pickupPoint.administrative_area_code,
            postalCode: pickupPoint.postal_code,
            notes: pickupPoint.notes ?? "",
          } : null} />
          {/* Its own form, next to the shop's: the delivery policy is saved by
              its own button because it may only change once a month. */}
          <section aria-labelledby="delivery-policy-title" className="mt-8 border-t border-line pt-6">
            <h3 className="font-display text-xl font-semibold" id="delivery-policy-title">Entregas</h3>
            <div className="mt-4">
              <DeliveryPolicyForm
                action={deliveryPolicyAction}
                policy={shop.delivery_policy ?? ""}
                unlocksAt={deliveryPolicyUnlocksOn}
              />
            </div>
          </section>
          <details className="mt-8 border-t border-line pt-6"><summary className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-sale"><Trash2 aria-hidden="true" className="size-4" />Eliminar tienda</summary><div className="mt-4 rounded-2xl bg-sale/10 p-4"><p className="text-sm leading-6 text-ink">Se eliminarán también todos sus productos e imágenes. Esta acción no se puede deshacer.</p><form action={deleteAction} className="mt-3"><button className="rounded-full bg-sale px-4 py-2 text-sm font-semibold text-white" type="submit">Confirmar eliminación</button></form></div></details>
        </details>
      </div>
    </section>
  );
}
