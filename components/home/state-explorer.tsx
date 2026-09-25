import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

import { buildCatalogHref } from "@/lib/categories";
import { findAdministrativeAreaByCode } from "@/lib/shop-location";
import type { CatalogStateCount } from "@/lib/queries/catalog.server";

/**
 * `catalog_state_counts` counts live products, not shops: published, enabled,
 * unexpired listings of approved shops, once per state the shop operates in.
 */
function productCountLabel(count: number) {
  return count === 1 ? "1 producto" : `${count} productos`;
}

export function StateExplorer({ counts }: { counts: CatalogStateCount[] }) {
  const areas = counts
    .map((entry) => ({ area: findAdministrativeAreaByCode(entry.code), count: entry.count }))
    .filter((entry) => entry.area !== undefined);

  if (!areas.length) return null;

  return (
    <section aria-labelledby="estados-heading" className="px-4 pb-16 sm:px-8 lg:pb-[104px]">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 rounded-[1.625rem] border border-line bg-surface px-5 py-7 lg:grid lg:grid-cols-12 lg:items-center lg:gap-x-6 lg:rounded-[2rem] lg:px-14 lg:py-[52px]">
        <div className="flex flex-col gap-4 lg:col-span-5">
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-brand lg:text-[13px]">
            Sin nada en mente
          </p>
          <h2
            className="font-display text-[34px] font-medium leading-[1.04] tracking-[-0.03em] text-ink lg:text-[44px]"
            id="estados-heading"
          >
            Explora <em className="italic text-brand">por estado.</em>
          </h2>
          <p className="text-[15px] leading-[1.6] text-muted lg:text-[17px]">
            Mira qué se publica cerca de ti y descubre talleres que no estabas buscando.
          </p>
        </div>
        <ul className="mt-1 flex flex-col gap-2.5 lg:col-span-7 lg:col-start-6 lg:mt-0 lg:grid lg:grid-cols-2 lg:gap-4">
          {areas.map(({ area, count }) => (
            <li key={area!.code}>
              <Link
                className="flex items-center gap-3.5 rounded-[1.125rem] border border-line bg-background px-4 py-3.5 text-ink transition-colors hover:border-brand lg:gap-4 lg:rounded-[1.375rem] lg:p-5"
                href={buildCatalogHref({ stateSlug: area!.slug })}
              >
                <span
                  aria-hidden="true"
                  className="grid size-[42px] shrink-0 place-items-center rounded-xl bg-brand text-accent lg:size-12 lg:rounded-[0.875rem]"
                >
                  <MapPin className="size-5 lg:size-[22px]" strokeWidth={1.8} />
                </span>
                <span className="flex grow flex-col gap-px lg:gap-0.5">
                  <span className="font-display text-[17px] font-semibold lg:text-[19px]">
                    {area!.label}
                  </span>
                  <span className="text-[13px] text-muted">{productCountLabel(count)}</span>
                </span>
                <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-brand" strokeWidth={2} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
