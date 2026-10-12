import Link from "next/link";
import { PackageOpen, SearchX } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { pageContainer } from "@/components/layout/container";
import { CatalogToolbar } from "@/components/products/catalog-toolbar";
import { ProductRow } from "@/components/products/product-row";
import { ReactivateExpiredButton } from "@/components/products/reactivate-expired-button";
import { ShopWorkspaceHeader } from "@/components/shops/shop-workspace-header";
import { ListingImportCard } from "@/components/shops/listing-import-card";
import { ShopAnalyticsCard } from "@/components/shops/shop-analytics-card";
import { TrustDashboardCard } from "@/components/shops/trust-dashboard-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { ListingStatus } from "@/components/ui/status-badge";
import { requestListingImport } from "@/lib/actions/listing-import";
import { getShopImportRequests } from "@/lib/queries/listing-import.server";
import { getShopAnalytics } from "@/lib/queries/shop-analytics.server";
import { getOwnedShop } from "@/lib/queries/shops.server";
import { getShopTrustDashboard } from "@/lib/queries/trust.server";
import { getShopPublicationApproval, getShopPublicationGuidance } from "@/lib/seller-publication";
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
  const created = query.creada === "1";
  const approval = getShopPublicationApproval(shop);
  const tab = parseCatalogTab(query.estado);
  const search = typeof query.buscar === "string" ? query.buscar : "";

  const supabase = await createServerSupabaseClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price_mxn, image_path, status, expires_at, is_admin_enabled, units_available")
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
  const isFounder = Boolean(shop.founder_since);
  const [trustDashboard, analytics, importRequests] = await Promise.all([
    getShopTrustDashboard(shopId),
    isFounder ? getShopAnalytics(shopId) : null,
    getShopImportRequests(shopId),
  ]);
  const isFiltered = tab !== "todos" || search.trim() !== "";

  return (
    <section className={`${pageContainer} py-10 sm:py-14`}>
      <ShopWorkspaceHeader active="catalogo" isPremium={shop.is_premium === true} shopId={shopId} shopName={shop.name} shopSlug={shop.slug} />

      {created ? (
        <section className="mb-6 rounded-[2rem] border border-brand/25 bg-accent/45 p-6 sm:p-8" aria-labelledby="shop-created-title">
          <h2 id="shop-created-title" className="font-display text-2xl font-semibold" role="status">Tu tienda se creó correctamente.</h2>
          <p className="mt-3 text-sm leading-6 text-muted">La página pública de tu tienda ya está disponible. Crear la tienda no equivale a tener permiso para publicar productos.</p>
          <Link className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand hover:bg-brand-hover" href={`/panel/tiendas/${shopId}/productos/nuevo`}>Agregar mi primer producto</Link>
        </section>
      ) : null}
      <section aria-labelledby="publication-approval-title" className="mb-6 rounded-[2rem] border border-line bg-surface p-6 sm:px-8">
        <h2 id="publication-approval-title" className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Permiso para publicar productos</h2>
        <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-bold ${approval.kind === "approved" ? "bg-accent text-brand-hover" : "bg-background text-muted"}`}>{approval.label}</p>
        <p className="mt-3 text-sm leading-6 text-muted">{getShopPublicationGuidance(shop)}</p>
        {!created ? <p className="mt-2 text-xs leading-5 text-muted">La página pública de tu tienda es independiente del permiso para publicar productos.</p> : null}
      </section>

      {trustDashboard ? <div className="mb-6"><TrustDashboardCard dashboard={trustDashboard} /></div> : null}
      {isFounder && !analytics ? null : <div className="mb-6"><ShopAnalyticsCard analytics={analytics} isFounder={isFounder} /></div>}
      <div className="mb-6"><ListingImportCard action={requestListingImport.bind(null, shopId)} requests={importRequests} /></div>

      <section aria-labelledby="catalogo-title" className="rounded-[2rem] border border-line bg-surface p-6 sm:p-8">
        <h2 className="sr-only" id="catalogo-title">Productos</h2>
        <p className="mb-4 text-sm text-muted">Espacios de publicación usados: {listings.filter((product) => product.status === "published").length} de {shop.listing_limit}. Los productos pendientes de aprobación y los bloqueados con publicación guardada también cuentan; los borradores no.</p>
        <CatalogToolbar counts={counts} search={search} shopId={shopId} tab={tab} />

        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line py-4">
          <p className="max-w-md text-xs leading-5 text-muted">Las unidades son las disponibles ahora; los pedidos ya hechos conservan las suyas.</p>
          <ReactivateExpiredButton count={counts.vencidos} shopId={shopId} />
        </div>

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
