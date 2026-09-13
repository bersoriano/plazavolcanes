import Link from "next/link";
import { PackageOpen, SearchX } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { CatalogToolbar } from "@/components/products/catalog-toolbar";
import { ProductRow } from "@/components/products/product-row";
import { ShopWorkspaceHeader } from "@/components/shops/shop-workspace-header";
import { TrustDashboardCard } from "@/components/shops/trust-dashboard-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { ListingStatus } from "@/components/ui/status-badge";
import { getOwnedShop } from "@/lib/queries/shops.server";
import { getShopTrustDashboard } from "@/lib/queries/trust.server";
import { organizeCatalog, parseCatalogTab } from "@/lib/seller-catalog";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MEDIA_VARIANTS, mediaUrls } from "@/lib/media/url";

export default async function ShopCatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (!isSupabaseConfigured()) redirect("/panel");
  const { id } = await params;
  const shopId = Number(id);
  if (!Number.isSafeInteger(shopId) || shopId < 1) notFound();

  const shop = await getOwnedShop(shopId);
  if (!shop) notFound();

  const query = await searchParams;
  const tab = parseCatalogTab(query.estado);
  const search = typeof query.buscar === "string" ? query.buscar : "";

  const supabase = await createServerSupabaseClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price_mxn, image_path, status, expires_at, is_admin_enabled")
    .eq("shop_id", shopId)
    .neq("status", "deleted")
    .order("created_at", { ascending: false });

  // Retired listings are kept only so their conversations still have something
  // to point at, and the query above leaves them out; narrowing here says so in
  // types.
  const listings = (products ?? []).filter(
    (product): product is typeof product & { status: ListingStatus } => product.status !== "deleted",
  );

  // The tier caps a catalogue at 100 listings, so the whole thing arrives in
  // one read and the filter runs in memory. That is what lets every tab carry
  // a true count while only one of them is on screen — and it keeps the counts
  // honest, since a listing's real state is not the `status` column alone.
  const { visible, counts } = organizeCatalog(listings, shop, { tab, search });

  // The shop's own picture is no longer asked for here: it belongs to the form
  // in /ajustes, which fetches it there.
  const imageUrls = mediaUrls(visible.map((product) => product.image_path), MEDIA_VARIANTS.thumbnail);
  const trustDashboard = await getShopTrustDashboard(shopId);
  const isFiltered = tab !== "todos" || search.trim() !== "";

  return (
    <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <ShopWorkspaceHeader active="catalogo" isPremium={shop.is_premium === true} shopId={shopId} shopName={shop.name} shopSlug={shop.slug} />

      {trustDashboard ? <div className="mb-6"><TrustDashboardCard dashboard={trustDashboard} /></div> : null}

      <section aria-labelledby="catalogo-title" className="rounded-[2rem] border border-line bg-surface p-6 sm:p-8">
        <h2 className="sr-only" id="catalogo-title">Productos</h2>
        <CatalogToolbar counts={counts} search={search} shopId={shopId} tab={tab} />

        {visible.length ? (
          <ul className="divide-y divide-line">
            {visible.map((product) => (
              <ProductRow
                key={product.id}
                product={{
                  ...product,
                  image_url: product.image_path ? (imageUrls.get(product.image_path) ?? null) : null,
                  is_publishing_approved: shop.is_publishing_approved,
                  publishing_reviewed_at: shop.publishing_reviewed_at,
                }}
              />
            ))}
          </ul>
        ) : (
          <div className="mt-6">
            {/* An empty shelf and a filter that matched nothing look the same
                and need opposite advice, so they are two states, not one. */}
            {isFiltered ? (
              <EmptyState
                icon={<SearchX aria-hidden="true" className="size-7" />}
                title="Sin resultados"
                description="Ningún producto coincide con este filtro."
                action={
                  <Link
                    className="tap inline-flex items-center font-semibold text-brand underline decoration-accent decoration-4 underline-offset-4"
                    href={`/panel/tiendas/${shopId}`}
                  >
                    Ver todos los productos
                  </Link>
                }
              />
            ) : (
              <EmptyState
                icon={<PackageOpen aria-hidden="true" className="size-7" />}
                title="Catálogo vacío"
                description="Agrega tu primer producto como borrador."
                action={
                  <Link
                    className="tap inline-flex items-center font-semibold text-brand underline decoration-accent decoration-4 underline-offset-4"
                    href={`/panel/tiendas/${shopId}/productos/nuevo`}
                  >
                    Agregar producto
                  </Link>
                }
              />
            )}
          </div>
        )}
      </section>
    </section>
  );
}
