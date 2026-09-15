import type { DashboardMetrics, MetricCounts } from "@/lib/seller-dashboard";
import { REPORTING_WINDOW_DAYS } from "@/lib/seller-dashboard";

const METRICS: { key: keyof MetricCounts; label: string; definition: string }[] = [
  {
    key: "inquiries",
    label: "Consultas de compradores",
    definition: "Conversaciones sobre un producto o tu tienda que empezaron en este periodo y en las que el comprador escribió.",
  },
  {
    key: "purchaseRequests",
    label: "Solicitudes de compra",
    definition: "Pedidos recibidos en este periodo, sin importar si después se aceptaron o cancelaron.",
  },
  {
    key: "completedOrders",
    label: "Pedidos completados",
    definition: "Pedidos que se completaron en este periodo, después de que el comprador confirmó que los recibió.",
  },
];

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

const dayMonth = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" });

/**
 * The few numbers the plaza can stand behind.
 *
 * Visits are listed and plainly marked as not measured, because a blank would
 * read as nobody came. No conversion rate is shown: enquiries and orders are
 * not tied to each other, and with no visit count there is no honest
 * denominator for either.
 */
export function SellerResults({ metrics, shopCount }: { metrics: DashboardMetrics; shopCount: number }) {
  const window = `${dayMonth.format(metrics.windowStart)} – ${dayMonth.format(metrics.windowEnd)}`;

  return (
    <section aria-labelledby="results-title" className="rounded-[2rem] border border-line bg-surface p-5 sm:p-7">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Resultados</p>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-2xl font-semibold tracking-[-0.02em]" id="results-title">
          Últimos {REPORTING_WINDOW_DAYS} días
        </h2>
        <span className="text-sm text-muted">{window}</span>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-background p-4">
          <dt className="text-sm font-semibold leading-5 text-ink">Visitas</dt>
          <dd className="mt-1 font-display text-xl font-semibold text-muted">Sin medir</dd>
        </div>
        {METRICS.map((metric) => (
          <div className="rounded-2xl bg-background p-4" key={metric.key}>
            <dt className="text-sm font-semibold leading-5 text-ink">{metric.label}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold text-ink">
              {metrics.ok ? metrics.total[metric.key] : <span className="text-xl text-muted">No disponible</span>}
            </dd>
          </div>
        ))}
      </dl>

      {!metrics.ok ? (
        <p className="mt-4 text-sm text-muted" role="status">
          No pudimos calcular tus resultados en este momento. Recarga el panel para intentarlo de nuevo.
        </p>
      ) : null}

      {metrics.ok && shopCount > 1 ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-ink">Por tienda</h3>
          <ul aria-label="Resultados por tienda" className="mt-2 divide-y divide-line">
            {metrics.byShop.map((row) => (
              <li className="py-2.5" key={row.shop.id}>
                <p className="font-semibold text-ink">{row.shop.name}</p>
                <p className="mt-0.5 text-sm tabular-nums text-muted">
                  {plural(row.counts.inquiries, "consulta", "consultas")} · {plural(row.counts.purchaseRequests, "solicitud", "solicitudes")} · {plural(row.counts.completedOrders, "completado", "completados")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <details className="group mt-4 rounded-2xl bg-background px-4 py-3">
        <summary className="tap cursor-pointer text-sm font-semibold text-brand">Qué cuenta cada número</summary>
        <dl className="mt-3 space-y-3 text-xs leading-5 text-muted">
          <div>
            <dt className="font-semibold text-ink">Visitas</dt>
            <dd>Plaza Volcanes todavía no cuenta visitas a tiendas ni productos, así que no mostramos una cifra.</dd>
          </div>
          {METRICS.map((metric) => (
            <div key={metric.key}>
              <dt className="font-semibold text-ink">{metric.label}</dt>
              <dd>{metric.definition}</dd>
            </div>
          ))}
        </dl>
      </details>

      <p className="mt-4 text-xs leading-5 text-muted">
        No calculamos tasas de conversión: una consulta y un pedido no siempre vienen de la misma persona, y sin visitas medidas no hay una base confiable.
      </p>
    </section>
  );
}
