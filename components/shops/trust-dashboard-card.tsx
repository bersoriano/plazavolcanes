import { BarChart3, CheckCircle2, CircleGauge, Target } from "lucide-react";

import { formatDate } from "@/lib/format";
import { getTrustTierMarker, type TrustDashboard } from "@/lib/trust-tiers";

function metric(value: number | null, suffix = "%") {
  return value === null ? "Sin datos" : `${Math.round(value * 10) / 10}${suffix}`;
}

export function TrustDashboardCard({ dashboard }: { dashboard: TrustDashboard }) {
  const marker = getTrustTierMarker(dashboard.tier);
  const usage = Math.min(100, Math.round((dashboard.publishedCount / dashboard.listingLimit) * 100));

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 sm:p-8" aria-labelledby="trust-dashboard-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Confianza</p>
          <h2 className="mt-1 font-display text-2xl font-semibold" id="trust-dashboard-title">Nivel {marker.label}</h2>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-accent/45 px-3 py-2 text-sm font-bold text-brand-hover"><CircleGauge aria-hidden="true" className="size-4" />{dashboard.publishedCount} de {dashboard.listingLimit} publicaciones</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-background" aria-label={`${usage}% del límite de publicaciones utilizado`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={usage}><div className="h-full rounded-full bg-brand" style={{ width: `${usage}%` }} /></div>
      <p className="mt-4 text-sm leading-6 text-muted">{dashboard.summary}</p>
      {dashboard.evaluatedAt ? <p className="mt-2 text-xs text-muted">Última evaluación: {formatDate(dashboard.evaluatedAt)}</p> : null}

      {dashboard.metrics ? <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3"><Metric label="Respuesta" value={metric(dashboard.metrics.responseRate)} /><Metric label="Tiempo de respuesta" value={metric(dashboard.metrics.averageReplyTimeMinutes, " min")} /><Metric label="Precisión" value={metric(dashboard.metrics.descriptionAccuracy)} /><Metric label="Envíos puntuales" value={metric(dashboard.metrics.onTimeShippingRate)} /><Metric label="Pedidos completados" value={metric(dashboard.metrics.orderCompletionRate)} /><Metric label="Disputas" value={metric(dashboard.metrics.disputeRate)} /></div> : null}

      {dashboard.reasons.length ? <div className="mt-6"><h3 className="flex items-center gap-2 font-semibold"><CheckCircle2 aria-hidden="true" className="size-4 text-brand" />Resultado</h3><ul className="mt-3 space-y-2 text-sm leading-6 text-muted">{dashboard.reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul></div> : null}
      {dashboard.nextRequirements.length ? <details className="mt-6 rounded-2xl bg-background p-4"><summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold"><Target aria-hidden="true" className="size-4 text-brand" />Cómo subir de nivel</summary><ul className="mt-3 space-y-2 text-sm leading-6 text-muted">{dashboard.nextRequirements.map((requirement) => <li key={requirement}>• {requirement}</li>)}</ul></details> : <p className="mt-6 flex items-center gap-2 text-sm font-semibold text-brand"><BarChart3 aria-hidden="true" className="size-4" />Cumples el nivel máximo.</p>}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-background p-3"><p className="text-xs text-muted">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}
