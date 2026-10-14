import { CalendarDays } from "lucide-react";

import {
  NO_DATA_LABEL,
  PUBLIC_TRUST_MARKERS,
  type PublicTrustMetrics,
} from "@/lib/public-trust";
import { generateMemberSinceMarker } from "@/lib/trust-markers";

type TrustProfile = { joinedOn: string };

type Badge = {
  key: string;
  label: string;
  value: string;
  explanation: string;
  measured: boolean;
  icon?: React.ReactNode;
};

function buildBadges(metrics: PublicTrustMetrics | null, profile: TrustProfile | null): Badge[] {
  const membership = profile ? generateMemberSinceMarker({ join_date: profile.joinedOn }) : null;

  return [
    {
      key: "membership",
      label: "Antigüedad",
      value: membership?.primary_text ?? NO_DATA_LABEL,
      explanation: membership
        ? `${membership.trust_signal}. ${membership.tooltip}`
        : "La antigüedad muestra cuánto tiempo lleva este vendedor activo en Plaza Volcanes.",
      measured: Boolean(membership),
      icon: <CalendarDays aria-hidden="true" className="size-3.5" />,
    },
    ...PUBLIC_TRUST_MARKERS.map((marker) => ({
      key: marker.key,
      label: marker.label,
      value: marker.value(metrics),
      explanation: marker.explanation,
      measured: marker.measured(metrics),
    })),
  ];
}

/** How many earned signals the shop header names before the full list. */
const EARNED_SIGNAL_COUNT = 3;

/**
 * The first few signals a shop has earned, as one quiet line. The full list,
 * measured and not, stays in `TrustBadges`; this never names a missing one.
 */
export function EarnedSignals({
  metrics,
  profile,
  className = "",
}: {
  metrics: PublicTrustMetrics | null;
  profile: TrustProfile | null;
  className?: string;
}) {
  const earned = buildBadges(metrics, profile)
    .filter((badge) => badge.measured)
    .slice(0, EARNED_SIGNAL_COUNT);
  if (!earned.length) return null;

  return (
    <ul
      aria-label="Señales ganadas"
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted ${className}`.trim()}
    >
      {earned.map((badge, index) => (
        <li className="inline-flex items-center gap-2" key={badge.key} title={badge.explanation}>
          {index ? <span aria-hidden="true">·</span> : null}
          {/* A number needs its label; a phrase like "Sin disputas" says it all. */}
          {/^\d/.test(badge.value) ? `${badge.label} ${badge.value}` : badge.value}
        </li>
      ))}
    </ul>
  );
}

export function TrustBadges({
  metrics,
  profile,
}: {
  metrics: PublicTrustMetrics | null;
  profile: TrustProfile | null;
}) {
  const badges = buildBadges(metrics, profile);

  return (
    <ul aria-label="Marcadores de confianza" className="mt-6 flex flex-wrap gap-2">
      {badges.map((badge) => (
        <li key={badge.key}>
          <span
            className={
              badge.measured
                ? "inline-flex items-center gap-2 rounded-full border border-transparent bg-brand px-3.5 py-2 text-xs font-semibold text-on-brand"
                : "inline-flex items-center gap-2 rounded-full border border-dashed border-line bg-transparent px-3.5 py-2 text-xs font-semibold text-muted"
            }
            data-state={badge.measured ? "measured" : "unmeasured"}
            data-testid={`trust-badge-${badge.key}`}
            title={badge.explanation}
          >
            {badge.icon ?? (
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full ${badge.measured ? "bg-accent" : "bg-line"}`}
              />
            )}
            {badge.label}
            <span className={badge.measured ? "font-bold text-accent" : "font-medium text-muted/80"}>
              {badge.value === NO_DATA_LABEL ? "Sin datos" : badge.value}
            </span>
            <span className="sr-only"> — {badge.explanation}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
