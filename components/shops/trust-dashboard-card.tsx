import { BarChart3, CheckCircle2, ChevronDown, CircleGauge, Target } from "lucide-react";

import { formatDate } from "@/lib/format";
import { getTrustTierMarker, type TrustDashboard } from "@/lib/trust-tiers";

function metric(value: number | null, suffix = "%") {
  return value === null ? "Sin datos" : `${Math.round(value * 10) / 10}${suffix}`;
}

/**
 * Confianza, folded.
 *
 * A seller opens this page to work on the catalogue; the trust tier is a thing
 * they check every few weeks. Folded, it costs one band instead of a screen —
 * but the band still carries the number they glance at in passing, so the fold
 * hides the explanation, never the state.
 */
export function TrustDashboardCard({ dashboard }: { dashboard: TrustDashboard }) {
  const marker = getTrustTierMarker(dashboard.tier);
  const usage = Math.min(100, Math.round((dashboard.publishedCount / dashboard.listingLimit) * 100));

  return (
    <details className="group rounded-[2rem] border border-line bg-surface px-6 py-5 sm:px-8">
      <summary className="flex cursor-pointer list-none flex-col gap-3 [&::-webkit-details-marker]:hidden">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Confianza</span>
            <span className="font-display text-lg font-semibold">Nivel {marker.label}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent/45 px-3 py-1.5 text-sm font-bold text-brand-hover">
              <CircleGauge aria-hidden="true" className="size-4" />
              {dashboard.publishedCount} de {dashboard.listingLimit} publicaciones
            </span>
            <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-brand transition-transform group-open:rotate-180" />
          </div>
        </div>
        <div
          aria-label={`${usage}% del límite de publicaciones utilizado`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={usage}
          className="h-2 overflow-hidden rounded-full bg-background"
          role="progressbar"
        >
          <div className="h-full rounded-full bg-brand" style={{ width: `${usage}%` }} />
        </div>
      </summary>

      <div className="mt-6 border-t border-line pt-6">
        <p className="text-sm leading-6 text-muted">{dashboard.summary}</p>
        {dashboard.evaluatedAt ? <p className="mt-2 text-xs text-muted">Última evaluación: {formatDate(dashboard.evaluatedAt)}</p> : null}

        {dashboard.metrics ? <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3"><Metric label="Respuesta" value={metric(dashboard.metrics.responseRate)} /><Metric label="Tiempo de respuesta" value={metric(dashboard.metrics.averageReplyTimeMinutes, " min")} /><Metric label="Precisión" value={metric(dashboard.metrics.descriptionAccuracy)} /><Metric label="Envíos puntuales" value={metric(dashboard.metrics.onTimeShippingRate)} /><Metric label="Pedidos completados" value={metric(dashboard.metrics.orderCompletionRate)} /><Metric label="Disputas" value={metric(dashboard.metrics.disputeRate)} /></div> : null}

        {dashboard.reasons.length ? <div className="mt-6"><h3 className="flex items-center gap-2 font-semibold"><CheckCircle2 aria-hidden="true" className="size-4 text-brand" />Resultado</h3><ul className="mt-3 space-y-2 text-sm leading-6 text-muted">{dashboard.reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul></div> : null}
        {dashboard.nextRequirements.length ? <div className="mt-6 rounded-2xl bg-background p-4"><h3 className="flex items-center gap-2 font-semibold"><Target aria-hidden="true" className="size-4 text-brand" />Cómo subir de nivel</h3><ul className="mt-3 space-y-2 text-sm leading-6 text-muted">{dashboard.nextRequirements.map((requirement) => <li key={requirement}>• {requirement}</li>)}</ul></div> : <p className="mt-6 flex items-center gap-2 text-sm font-semibold text-brand"><BarChart3 aria-hidden="true" className="size-4" />Cumples el nivel máximo.</p>}
      </div>
    </details>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-background p-3"><p className="text-xs text-muted">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}
