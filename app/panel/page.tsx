import Link from "next/link";
import { CircleUserRound, MessageCircle, PackageOpen, RotateCw } from "lucide-react";

import { AttentionList } from "@/components/seller-dashboard/attention-list";
import { FirstSaleChecklist } from "@/components/seller-dashboard/first-sale-checklist";
import { OngoingTasks } from "@/components/seller-dashboard/ongoing-tasks";
import { PrimaryActionCard } from "@/components/seller-dashboard/primary-action";
import { SellerResults } from "@/components/seller-dashboard/seller-results";
import { ShopOverview } from "@/components/seller-dashboard/shop-overview";
import { getSellerDashboard } from "@/lib/queries/seller-dashboard.server";
import { buildSiteUrl } from "@/lib/site-url";

const secondaryLink =
  "tap inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-brand transition-colors hover:border-brand";

function parseShopId(value: string | string[] | undefined) {
  const id = typeof value === "string" ? Number(value) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export default async function PanelPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = (await searchParams) ?? {};
  // Only a shop this seller owns can be picked; anything else falls back to
  // the default choice inside the dashboard rather than erroring.
  const result = await getSellerDashboard({ requestedFocusShopId: parseShopId(query.tienda) });
  if (!result) return null;

  return (
    <section className="mx-auto max-w-[1200px] px-5 py-8 sm:px-8 sm:py-12">
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Tu espacio</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">Panel de ventas</h1>
        </div>
        <nav aria-label="Accesos del panel" className="flex flex-wrap gap-2">
          <Link className={secondaryLink} href="/mensajes">
            <MessageCircle aria-hidden="true" className="size-4" />
            Mensajes
          </Link>
          <Link className={secondaryLink} href="/panel/pedidos">
            <PackageOpen aria-hidden="true" className="size-4" />
            Pedidos
          </Link>
          <Link className={secondaryLink} href="/panel/cuenta">
            <CircleUserRound aria-hidden="true" className="size-4" />
            Mi cuenta
          </Link>
        </nav>
      </header>

      {result.status === "error" ? <DashboardError /> : <Dashboard result={result} />}
    </section>
  );
}

function Dashboard({ result }: { result: Extract<Awaited<ReturnType<typeof getSellerDashboard>>, { status: "ready" }> }) {
  const { dashboard, now, shopImageUrls } = result;
  const focus = dashboard.shops.find((entry) => entry.shop.id === dashboard.focusShopId) ?? null;
  const shareUrl = focus && focus.publicListingCount > 0 ? buildSiteUrl(`/tiendas/${focus.shop.slug}`) : null;
  const hasShops = dashboard.shops.length > 0;

  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        <div className="space-y-6">
          <PrimaryActionCard primary={dashboard.primary} />
          <AttentionList items={dashboard.attention} now={now} unavailable={dashboard.unavailable.attention} />
          {dashboard.mode === "ongoing" ? (
            dashboard.unavailable.listings ? null : <OngoingTasks tasks={dashboard.ongoing} />
          ) : (
            <FirstSaleChecklist
              checklist={dashboard.checklist}
              focusShopId={dashboard.focusShopId}
              shareUrl={shareUrl}
              shops={dashboard.shops.map((entry) => ({ id: entry.shop.id, name: entry.shop.name }))}
            />
          )}
        </div>
        {hasShops ? <SellerResults metrics={dashboard.metrics} shopCount={dashboard.shops.length} /> : null}
      </div>

      <div className="mt-10">
        <ShopOverview
          canCreateShop={dashboard.canCreateShop}
          imageUrls={shopImageUrls}
          listingsLoaded={!dashboard.unavailable.listings}
          shopLimit={dashboard.shopLimit}
          shops={dashboard.shops}
        />
      </div>
    </>
  );
}

function DashboardError() {
  return (
    <div className="rounded-[2rem] border border-line bg-surface p-6 sm:p-8" role="alert">
      <h2 className="font-display text-2xl font-semibold">No pudimos cargar tu panel</h2>
      <p className="mt-2 max-w-xl leading-7 text-muted">
        Tus tiendas y pedidos están a salvo; solo falló la consulta. Vuelve a intentarlo en un momento.
      </p>
      <Link className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-on-brand" href="/panel">
        <RotateCw aria-hidden="true" className="size-4" />
        Reintentar
      </Link>
    </div>
  );
}
