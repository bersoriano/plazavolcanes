import { BadgeCheck, CalendarDays } from "lucide-react";

import {
  NO_DATA_LABEL,
  PUBLIC_TRUST_MARKERS,
  type PublicTrustMetrics,
} from "@/lib/public-trust";
import {
  generateMemberSinceMarker,
  generateVerificationMarker,
  type VerificationLevel,
} from "@/lib/trust-markers";

type TrustProfile = { joinedOn: string; verificationLevel: VerificationLevel };

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
  const verification = profile ? generateVerificationMarker(profile.verificationLevel) : null;

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
    {
      key: "verification",
      label: "Verificación",
      value: verification?.primary_text ?? NO_DATA_LABEL,
      explanation:
        verification?.tooltip ?? "El nivel de verificación resume qué datos confirmó el vendedor.",
      measured: Boolean(verification),
      icon: <BadgeCheck aria-hidden="true" className="size-3.5" />,
    },
    ...PUBLIC_TRUST_MARKERS.map((marker) => {
      const value = marker.value(metrics);

      return {
        key: marker.key,
        label: marker.label,
        value,
        explanation: marker.explanation,
        measured: value !== NO_DATA_LABEL,
      };
    }),
  ];
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
                ? "inline-flex items-center gap-2 rounded-full bg-brand px-3.5 py-2 text-xs font-semibold text-white"
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
              {badge.measured ? badge.value : "Sin datos"}
            </span>
            <span className="sr-only"> — {badge.explanation}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
