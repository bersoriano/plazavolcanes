import { Gauge } from "lucide-react";

import { formatDate } from "@/lib/format";
import {
  NO_DATA_LABEL,
  PUBLIC_TRUST_MARKERS,
  type PublicTrustMetrics,
} from "@/lib/public-trust";

export function PublicTrustPanel({ metrics }: { metrics: PublicTrustMetrics | null }) {
  return (
    <section
      aria-labelledby="medicion-heading"
      className="mt-8 rounded-[1.75rem] border border-line bg-background/65 p-5 sm:p-7"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/55 text-brand">
          <Gauge aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2
            className="font-display text-xl font-semibold tracking-[-0.02em] text-ink"
            id="medicion-heading"
          >
            Qué mide Plaza Volcanes
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Estas son todas las señales que seguimos para cada tienda y que definen su nivel de
            confianza. Nadie puede editar sus propias métricas.
          </p>
        </div>
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        {PUBLIC_TRUST_MARKERS.map((marker) => {
          const value = marker.value(metrics);
          const missing = value === NO_DATA_LABEL;

          return (
            <div className="rounded-2xl border border-line bg-surface p-4" key={marker.key}>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                  {marker.label}
                </dt>
                <dd
                  className={`shrink-0 text-sm font-semibold ${missing ? "text-muted" : "text-brand"}`}
                >
                  {value}
                </dd>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted">{marker.explanation}</p>
            </div>
          );
        })}
      </dl>

      <p className="mt-5 text-xs text-muted">
        {metrics?.evaluatedAt
          ? `Última evaluación: ${formatDate(metrics.evaluatedAt)}.`
          : "Esta tienda todavía no tiene una evaluación con datos suficientes."}
      </p>
    </section>
  );
}
