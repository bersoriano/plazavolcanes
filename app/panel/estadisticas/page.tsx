import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SellerAnalyticsReport } from "@/components/analytics/seller-analytics-report";
import { pageContainer } from "@/components/layout/container";
import { getSellerAnalytics } from "@/lib/queries/seller-analytics.server";
import { requireSignedIn } from "@/lib/require-signed-in.server";
import { parseAnalyticsFilters } from "@/lib/seller-analytics";

export const metadata: Metadata = { title: "Estadísticas" };

export default async function SellerAnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireSignedIn("/panel/estadisticas");
  const filters = parseAnalyticsFilters(await searchParams);
  const result = await getSellerAnalytics(filters);
  if (result.status === "invalid_shop") notFound();
  const selectStyle = "min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink";
  return <section className={`${pageContainer} py-10 sm:py-14`}>
    <div className="mb-8 max-w-2xl"><h1 className="font-display text-4xl font-semibold tracking-[-0.04em] text-ink">Estadísticas</h1>
      <p className="mt-3 leading-7 text-muted">Descubre qué productos atraen miradas y cuáles despiertan interés en tus tiendas.</p>
    </div>
    {result.status === "error" ? <div className="rounded-2xl border border-line bg-surface p-6" role="alert">
      <h2 className="font-display text-xl font-semibold">No pudimos cargar tus estadísticas</h2>
      <p className="mt-2 text-sm text-muted">Tus productos siguen disponibles. Intenta de nuevo en unos minutos.</p>
      <Link className="mt-3 inline-flex min-h-11 items-center font-semibold text-brand underline" href="/panel/estadisticas">Reintentar</Link>
    </div> : result.report.shops.length === 0 ? <div className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="font-display text-xl font-semibold">Las estadísticas empiezan con tu tienda</h2>
      <p className="mt-2 text-sm text-muted">Crea tu tienda y publica tus primeros productos para ver su actividad aquí.</p>
      <Link className="mt-4 inline-flex min-h-12 items-center rounded-full bg-brand px-6 font-semibold text-on-brand" href="/panel/tiendas/nueva">Crear mi tienda</Link>
    </div> : <>
      <form action="/panel/estadisticas" className="mb-7 flex flex-wrap items-end gap-3" method="get">
        <label className="grid min-w-48 flex-1 gap-2 text-sm font-semibold sm:max-w-xs">Tienda
          <select className={selectStyle} defaultValue={filters.shopId ?? "todas"} name="tienda">
            <option value="todas">Todas mis tiendas</option>
            {result.report.shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
          </select>
        </label>
        <label className="grid min-w-40 gap-2 text-sm font-semibold">Periodo
          <select className={selectStyle} defaultValue={filters.days} name="dias">{[7, 30, 90].map((days) => <option key={days} value={days}>Últimos {days} días</option>)}</select>
        </label>
        <button className="min-h-12 rounded-full bg-brand px-6 font-semibold text-on-brand hover:bg-brand-hover" type="submit">Aplicar</button>
      </form>
      <SellerAnalyticsReport report={result.report} />
    </>}
  </section>;
}
