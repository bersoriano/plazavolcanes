import { ChevronDown } from "lucide-react";

import { PremiumBadge } from "@/components/shops/premium-badge";
import { ReputationBadge } from "@/components/shops/reputation-badge";
import { TrustBadges } from "@/components/shops/trust-badges";
import type { TrustMetricsResult } from "@/lib/public-trust";
import {
  hasMeasuredHistory,
  newSellerNote,
  publicReputationTier,
  PREMIUM_DETAILS,
  PREMIUM_SUMMARY,
  REPUTATION_HEADING,
  summarizeSellingHistory,
} from "@/lib/seller-standing";
import type { TrustTier } from "@/lib/trust-tiers";

/**
 * What the plaza grants, what the shop earned, and what is not known yet —
 * in that order, in the same words, on every surface that shows a seller.
 */

/** Premium and the earned tier, side by side, for a heading row. */
export function SellerBadges({
  premium,
  tier,
  className = "",
}: {
  premium: boolean;
  tier: TrustTier;
  className?: string;
}) {
  if (!premium && !publicReputationTier(tier)) return null;

  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`.trim()}>
      {premium ? <PremiumBadge /> : null}
      <ReputationBadge tier={tier} />
    </span>
  );
}

/**
 * What Premium means, in reach of a keyboard and a thumb.
 *
 * The summary line is always visible — the distinction never depends on hover
 * to be understood — and the rest sits behind a native disclosure, which is
 * focusable, operable with Enter or Space, and announced as expandable.
 */
export function PremiumNote({ id }: { id?: string }) {
  return (
    <div className="mt-3 max-w-2xl" data-testid="premium-note">
      <p className="text-sm font-semibold text-ink">{PREMIUM_SUMMARY}</p>
      <details className="group mt-1" id={id}>
        <summary className="tap inline-flex cursor-pointer list-none items-center gap-1.5 rounded-sm text-sm font-semibold text-brand [&::-webkit-details-marker]:hidden">
          Qué incluye la distinción Premium
          <ChevronDown
            aria-hidden="true"
            className="size-4 transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="mt-2 space-y-2 text-sm leading-6 text-muted">
          {PREMIUM_DETAILS.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </details>
    </div>
  );
}

/** The one-line, neutral statement of what this shop has actually sold. */
export function SellingHistoryNote({
  metrics,
  joinedOn = null,
  className = "",
}: {
  metrics: TrustMetricsResult;
  joinedOn?: string | null;
  className?: string;
}) {
  const summary = summarizeSellingHistory(metrics);
  const isNew = summary.state === "empty" ? newSellerNote(joinedOn) : null;

  return (
    <div className={`max-w-2xl ${className}`.trim()} data-testid="selling-history">
      <p className="text-sm text-ink" data-state={summary.state}>
        <span className="font-semibold">{REPUTATION_HEADING}:</span> {summary.headline}
        {isNew ? <span className="text-muted"> · {isNew}</span> : null}
      </p>
      {summary.detail ? <p className="mt-1 text-sm leading-6 text-muted">{summary.detail}</p> : null}
    </div>
  );
}

/**
 * The full standing block for a storefront.
 *
 * A shop with nothing measured yet gets the summary and no grid: ten empty
 * pills say nothing a buyer can use and push the products off the screen. The
 * grid opens by default once there is something in it.
 */
export function SellerStanding({
  premium,
  metrics,
  profile,
  joinedOn = null,
}: {
  premium: boolean;
  metrics: TrustMetricsResult;
  profile: { joinedOn: string } | null;
  joinedOn?: string | null;
}) {
  const measured = hasMeasuredHistory(metrics);

  return (
    <section aria-labelledby="seller-standing-title" className="mt-7">
      <h2 className="sr-only" id="seller-standing-title">
        Distinción e historial de esta tienda
      </h2>
      {premium ? <PremiumNote /> : null}
      <SellingHistoryNote className="mt-4" joinedOn={joinedOn} metrics={metrics} />

      {metrics.status === "unavailable" ? null : (
        <details className="group mt-3" open={measured}>
          <summary className="tap inline-flex cursor-pointer list-none items-center gap-1.5 rounded-sm text-sm font-semibold text-brand [&::-webkit-details-marker]:hidden">
            Ver todo lo que Plaza Volcanes mide
            <ChevronDown
              aria-hidden="true"
              className="size-4 transition-transform group-open:rotate-180"
            />
          </summary>
          <TrustBadges metrics={metrics} profile={profile} />
          <p className="mt-3 text-xs leading-5 text-muted">
            Estas son todas las señales que Plaza Volcanes mide para cada tienda. Nadie puede editar
            sus propias métricas.
          </p>
        </details>
      )}
    </section>
  );
}
