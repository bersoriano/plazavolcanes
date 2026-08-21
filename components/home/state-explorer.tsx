import Link from "next/link";
import { MapPin } from "lucide-react";

import { buildCatalogHref } from "@/lib/categories";
import { findAdministrativeAreaByCode } from "@/lib/shop-location";
import type { CatalogStateCount } from "@/lib/queries/catalog.server";

export function StateExplorer({ counts }: { counts: CatalogStateCount[] }) {
  const areas = counts
    .map((entry) => ({ area: findAdministrativeAreaByCode(entry.code), count: entry.count }))
    .filter((entry) => entry.area !== undefined);

  if (!areas.length) return null;

  return (
    <section
      aria-labelledby="estados-heading"
      className="mx-auto max-w-[1440px] px-5 pb-4 sm:px-8 lg:px-12"
    >
      <div className="rounded-[2rem] border border-line bg-surface px-6 py-9 sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
          Sin nada en mente
        </p>
        <h2
          className="mt-3 font-display text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl"
          id="estados-heading"
        >
          Explora por estado
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
          Mira qué se publica cerca de ti y descubre talleres que no estabas buscando.
        </p>
        <ul className="mt-7 flex flex-wrap gap-3">
          {areas.map(({ area, count }) => (
            <li key={area!.code}>
              <Link
                className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-line bg-background px-4 text-sm font-semibold text-brand transition-colors hover:border-brand"
                href={buildCatalogHref({ stateSlug: area!.slug })}
              >
                <MapPin aria-hidden="true" className="size-4" />
                {area!.label}
                <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-brand-hover">
                  {count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
