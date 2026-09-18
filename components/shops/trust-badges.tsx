import { CalendarDays } from "lucide-react";

import {
  NO_DATA_LABEL,
  readTrustSignals,
  type PublicTrustSignal,
  type TrustMetricsResult,
  type TrustSignalState,
} from "@/lib/public-trust";
import { generateMemberSinceMarker } from "@/lib/trust-markers";

type TrustProfile = { joinedOn: string };

type Badge = PublicTrustSignal & { icon?: React.ReactNode };

const STATE_CLASSES: Record<TrustSignalState, string> = {
  // Earned: the plaza's own colour, so it reads as a result.
  measured: "border-transparent bg-brand text-on-brand",
  // A real zero over a real denominator. It is a fact, not an achievement and
  // not an absence, so it gets its own solid, uncoloured pill and stays legible.
  zero: "border-line bg-surface text-ink",
  // Nothing eligible has happened yet.
  empty: "border-dashed border-line bg-transparent text-muted",
};

const VALUE_CLASSES: Record<TrustSignalState, string> = {
  measured: "font-bold text-accent",
  zero: "font-bold text-ink",
  empty: "font-medium text-muted/80",
};

const DOT_CLASSES: Record<TrustSignalState, string> = {
  measured: "bg-accent",
  zero: "bg-brand",
  empty: "bg-line",
};

function buildBadges(result: TrustMetricsResult, profile: TrustProfile | null): Badge[] {
  const membership = profile ? generateMemberSinceMarker({ join_date: profile.joinedOn }) : null;
  const metrics = result.status === "ready" ? result.metrics : null;

  return [
    {
      key: "membership",
      label: "Antigüedad",
      value: membership?.primary_text ?? NO_DATA_LABEL,
      explanation: membership
        ? `${membership.tooltip}`
        : "La antigüedad muestra cuánto tiempo lleva este vendedor activo en Plaza Volcanes.",
      state: membership ? "measured" : "empty",
      context: null,
      icon: <CalendarDays aria-hidden="true" className="size-3.5" />,
    },
    ...readTrustSignals(metrics),
  ];
}

export function TrustBadges({
  metrics,
  profile,
}: {
  metrics: TrustMetricsResult;
  profile: TrustProfile | null;
}) {
  if (metrics.status === "unavailable") {
    return (
      <p
        className="mt-6 rounded-2xl border border-dashed border-line px-4 py-3 text-sm leading-6 text-muted"
        data-testid="trust-badges-unavailable"
        role="status"
      >
        No pudimos leer las métricas de esta tienda. Vuelve a cargar la página para intentarlo de
        nuevo.
      </p>
    );
  }

  const badges = buildBadges(metrics, profile);

  return (
    <ul aria-label="Marcadores de confianza" className="mt-6 flex flex-wrap gap-2">
      {badges.map((badge) => (
        <li key={badge.key}>
          <span
            className={`inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold ${STATE_CLASSES[badge.state]}`}
            data-state={badge.state}
            data-testid={`trust-badge-${badge.key}`}
            title={badge.explanation}
          >
            {badge.icon ?? (
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full ${DOT_CLASSES[badge.state]}`}
              />
            )}
            {badge.label}
            <span className={VALUE_CLASSES[badge.state]}>
              {badge.value === NO_DATA_LABEL ? "Sin datos" : badge.value}
            </span>
            {badge.context ? (
              <span className="font-medium opacity-80">({badge.context})</span>
            ) : null}
            <span className="sr-only"> — {badge.explanation}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
