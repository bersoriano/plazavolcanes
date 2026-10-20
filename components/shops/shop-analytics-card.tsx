import Link from "next/link";
import { BarChart3 } from "lucide-react";

import { ANALYTICS_DAYS, type ShopAnalytics } from "@/lib/shop-analytics";

const number = new Intl.NumberFormat("es-MX");

/**
 * The shop's last 30 days, now available to every seller. Detailed CTA
 * measurements and filters live in the dedicated statistics section.
 */
export function ShopAnalyticsCard({ analytics }: { analytics: ShopAnalytics | null; isFounder?: boolean }) {
  if (!analytics) {
    return (
      <section aria-labelledby="estadisticas-title" className="rounded-[2rem] border border-dashed border-line bg-surface px-6 py-5 sm:px-8">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-brand" id="estadisticas-title">
          <BarChart3 aria-hidden="true" className="size-4" />
          Estadísticas
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Consulta visitas, actividad de botones, preguntas y solicitudes de tus productos.
        </p>
        <Link className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand underline" href="/panel/estadisticas">Abrir Estadísticas</Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="estadisticas-title" className="rounded-[2rem] border border-line bg-surface px-6 py-5 sm:px-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-brand" id="estadisticas-title">
          <BarChart3 aria-hidden="true" className="size-4" />
          Estadísticas
        </h2>
        <p className="text-xs text-muted">Últimos {ANALYTICS_DAYS} días</p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label="Visitas" value={number.format(analytics.views)} />
        <Metric label="Preguntas" value={number.format(analytics.questions)} />
        <Metric
          label="Preguntas por 100 visitas"
          value={analytics.questionRate === null ? "Sin datos" : number.format(analytics.questionRate)}
        />
      </dl>
      <Link className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand underline" href="/panel/estadisticas">Abrir Estadísticas</Link>

      {analytics.top.length ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold">Lo más visto</h3>
          <ul className="mt-2 divide-y divide-line text-sm">
            {analytics.top.map((row) => (
              <li className="flex items-center justify-between gap-4 py-2" key={row.product_id}>
                <Link className="min-w-0 truncate font-medium text-brand hover:underline" href={`/productos/${row.slug}`}>
                  {row.name}
                </Link>
                <span className="shrink-0 tabular-nums text-muted">
                  {number.format(row.views)} visitas · {number.format(row.questions)} preguntas
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm leading-6 text-muted">Aún no hay visitas. Comparte tu tienda para recibir las primeras.</p>
      )}

      {analytics.quiet.length ? (
        <div className="mt-5 rounded-2xl bg-background p-4">
          <h3 className="text-sm font-semibold">Se ven, pero nadie pregunta</h3>
          <p className="mt-1 text-xs leading-5 text-muted">Revisa la foto, el precio o la descripción de estos productos.</p>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {analytics.quiet.map((row) => (
              <li className="flex justify-between gap-4" key={row.product_id}>
                <span className="min-w-0 truncate">{row.name}</span>
                <span className="shrink-0 tabular-nums text-muted">{number.format(row.views)} visitas</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-background p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
