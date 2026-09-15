import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ShareActions } from "@/components/share/share-actions";
import type { PrimaryAction } from "@/lib/seller-dashboard";
import { buildSiteUrl } from "@/lib/site-url";

/**
 * The one thing to do next, first on the page at every width.
 *
 * It is chosen from the seller's actual state, so it is always a single card:
 * two equally loud suggestions would put the choosing back on the seller.
 */
export function PrimaryActionCard({ primary }: { primary: PrimaryAction }) {
  return (
    <section
      aria-labelledby="primary-action-title"
      className="rounded-[2rem] bg-brand px-6 py-7 text-on-brand sm:px-8 sm:py-8"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-brand/75">
        Tu siguiente paso · {primary.eyebrow}
      </p>
      <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl" id="primary-action-title">
        {primary.title}
      </h2>
      <p className="mt-3 max-w-2xl leading-7 text-on-brand/85">{primary.detail}</p>

      {primary.action ? (
        <Link
          className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-surface px-6 py-3 text-sm font-semibold text-brand transition-colors hover:bg-accent"
          href={primary.action.href}
        >
          {primary.action.label}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      ) : null}

      {primary.share ? (
        // The existing share controls sit on a light panel of their own, so
        // they keep the contrast they were designed with.
        <div className="mt-6 inline-flex max-w-full rounded-[1.5rem] bg-surface p-3 text-ink">
          <ShareActions
            label={`Compartir ${primary.share.name}`}
            title={primary.share.name}
            url={buildSiteUrl(`/tiendas/${primary.share.slug}`)}
          />
        </div>
      ) : null}
    </section>
  );
}
