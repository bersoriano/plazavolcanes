import { BadgeCheck, CalendarDays, CircleHelp } from "lucide-react";

import {
  generateMemberSinceMarker,
  generateVerificationMarker,
  type VerificationLevel,
} from "@/lib/trust-markers";

type TrustMarkersProps = {
  joinedOn: string;
  verificationLevel: VerificationLevel;
};

type MarkerProps = {
  badge: string;
  icon: React.ReactNode;
  label: string;
  primaryText: string;
  tooltip: string;
  tooltipId: string;
};

function Marker({
  badge,
  icon,
  label,
  primaryText,
  tooltip,
  tooltipId,
}: MarkerProps) {
  return (
    <div className="group relative rounded-2xl border border-line bg-background/65 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/55 text-brand">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
              {label}
            </p>
            <button
              aria-describedby={tooltipId}
              aria-label={`Más información sobre ${label.toLowerCase()}`}
              className="grid size-6 place-items-center rounded-full text-muted hover:text-brand"
              type="button"
            >
              <CircleHelp aria-hidden="true" className="size-3.5" />
            </button>
          </div>
          <p className="mt-1 text-sm font-semibold text-ink">{primaryText}</p>
          <span className="mt-2 inline-flex rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-brand-hover">
            {badge}
          </span>
        </div>
      </div>
      <span
        className="pointer-events-none absolute left-4 top-[calc(100%+.5rem)] z-20 w-64 rounded-xl bg-brand-hover px-3 py-2 text-xs leading-5 text-white opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
        id={tooltipId}
        role="tooltip"
      >
        {tooltip}
      </span>
    </div>
  );
}

export function TrustMarkers({
  joinedOn,
  verificationLevel,
}: TrustMarkersProps) {
  const membership = generateMemberSinceMarker({ join_date: joinedOn });
  const verification = generateVerificationMarker(verificationLevel);

  return (
    <div
      aria-label="Marcadores de confianza del vendedor"
      className="mt-6 grid gap-3 sm:grid-cols-2"
      role="group"
    >
      <Marker
        badge={membership.trust_signal}
        icon={<CalendarDays aria-hidden="true" className="size-5" />}
        label="Antigüedad"
        primaryText={membership.primary_text}
        tooltip={membership.tooltip}
        tooltipId="member-since-tooltip"
      />
      <Marker
        badge={verification.badge_label}
        icon={<BadgeCheck aria-hidden="true" className="size-5" />}
        label="Verificación"
        primaryText={verification.primary_text}
        tooltip={verification.tooltip}
        tooltipId="verification-level-tooltip"
      />
    </div>
  );
}
