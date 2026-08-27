import { CalendarDays, CheckCircle2, CircleHelp, ShieldCheck, Target } from "lucide-react";

import {
  formatBuyerSignal,
  getBuyerStanding,
  type BuyerTrustOutput,
  type BuyerTrustSignal,
} from "@/lib/buyer-trust";

const markerLabels: Record<keyof BuyerTrustOutput["markers"], string> = {
  total_completed_purchases: "Compras completadas",
  buyer_completion_rate: "Tasa de finalización",
  claim_rate: "Reclamos",
  cancellation_rate: "Cancelaciones",
  payment_reliability: "Pagos confiables",
  average_time_to_close: "Tiempo para pagar",
  fast_closer_rate: "Cierres rápidos",
  response_rate: "Respuestas",
  review_rate: "Reseñas",
  recent_activity: "Actividad reciente",
};

const markerOrder = Object.keys(markerLabels) as (keyof BuyerTrustOutput["markers"])[];

function signalClass(signal: BuyerTrustSignal) {
  if (signal === "Excellent" || signal === "Good") return "bg-accent/55 text-brand-hover";
  if (signal === "Needs improvement") return "bg-sale/10 text-sale";
  return "bg-background text-muted";
}

function IdentityMarker({
  icon,
  label,
  primary,
  badge,
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  primary: string;
  badge?: string;
  tooltip: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-background/65 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/55 text-brand">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{label}</p>
          <p className="mt-1 text-sm font-semibold">{primary}</p>
          {badge ? <span className="mt-2 inline-flex rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-brand-hover">{badge}</span> : null}
          <p className="mt-2 text-xs leading-5 text-muted">{tooltip}</p>
        </div>
      </div>
    </div>
  );
}

function BehaviorMarker({ name, marker }: { name: keyof BuyerTrustOutput["markers"]; marker: BuyerTrustOutput["markers"][keyof BuyerTrustOutput["markers"]] }) {
  const tooltipId = `buyer-marker-${name}`;
  return (
    <div className="group relative rounded-2xl border border-line bg-surface p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-muted">{markerLabels[name]}</p>
          <p className="mt-1 text-sm font-bold text-ink">{marker.primary_text}</p>
        </div>
        <button
          aria-describedby={tooltipId}
          aria-label={`Más información sobre ${markerLabels[name].toLowerCase()}`}
          className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:text-brand"
          type="button"
        >
          <CircleHelp aria-hidden="true" className="size-4" />
        </button>
      </div>
      <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${signalClass(marker.signal)}`}>
        {formatBuyerSignal(marker.signal)}
      </span>
      <span
        className="pointer-events-none absolute right-3 top-[calc(100%+.4rem)] z-30 w-64 rounded-xl bg-brand-hover px-3 py-2 text-xs leading-5 text-white opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
        id={tooltipId}
        role="tooltip"
      >
        {marker.tooltip}
      </span>
    </div>
  );
}

export function BuyerTrustCard({ trust }: { trust: BuyerTrustOutput }) {
  return (
    <section aria-labelledby="buyer-standing" className="rounded-[2rem] border border-line bg-surface p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand text-accent">
          <ShieldCheck aria-hidden="true" className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Confianza del comprador</p>
          <h2 className="mt-1 font-display text-2xl font-semibold" id="buyer-standing">{getBuyerStanding(trust)}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{trust.summary}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <IdentityMarker icon={<CalendarDays aria-hidden="true" className="size-5" />} label="Antigüedad" primary={trust.member_since.primary_text} tooltip={trust.member_since.tooltip} />
      </div>

      <div aria-label="Señales de confianza del comprador" className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="group">
        {markerOrder.map((name) => <BehaviorMarker key={name} marker={trust.markers[name]} name={name} />)}
      </div>

      {trust.reasons.length ? <div className="mt-6"><h3 className="flex items-center gap-2 font-semibold"><CheckCircle2 aria-hidden="true" className="size-4 text-brand" />Por qué tiene este nivel</h3><ul className="mt-3 space-y-2 text-sm leading-6 text-muted">{trust.reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul></div> : null}
      {trust.next_tier_requirements.length ? <details className="mt-6 rounded-2xl bg-background p-4"><summary className="flex cursor-pointer items-center gap-2 font-semibold"><Target aria-hidden="true" className="size-4 text-brand" />Cómo llegar al siguiente nivel</summary><ul className="mt-3 space-y-2 text-sm leading-6 text-muted">{trust.next_tier_requirements.map((requirement) => <li key={requirement}>• {requirement}</li>)}</ul></details> : null}
    </section>
  );
}
