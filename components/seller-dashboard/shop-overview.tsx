import Link from "next/link";
import { ExternalLink, Plus, Settings, Store } from "lucide-react";

import { PremiumBadge } from "@/components/shops/premium-badge";
import type { ShopProgress } from "@/lib/seller-dashboard";
import { getTrustTierMarker } from "@/lib/trust-tiers";

/**
 * Every shop, with the way into its catalogue, settings and public page.
 *
 * This is where the panel used to start. It now sits below the work, quieter,
 * but nothing that was reachable from here went away — and the publication
 * quota and trust level ride along as plain text rather than as a headline.
 */
export function ShopOverview({
  shops,
  imageUrls,
  canCreateShop,
  shopLimit,
  listingsLoaded,
}: {
  shops: ShopProgress[];
  imageUrls: ReadonlyMap<string, string>;
  canCreateShop: boolean;
  shopLimit: number;
  listingsLoaded: boolean;
}) {
  const limitLabel = `${shopLimit} ${shopLimit === 1 ? "tienda" : "tiendas"}`;

  return (
    <section aria-labelledby="shops-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold tracking-[-0.02em]" id="shops-title">
          Mis tiendas
        </h2>
        {canCreateShop && shops.length ? (
          <Link
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-brand transition-colors hover:border-brand"
            href="/panel/tiendas/nueva"
          >
            <Plus aria-hidden="true" className="size-4" />
            Crear tienda
          </Link>
        ) : null}
      </div>

      {!canCreateShop ? (
        <p className="mt-4 rounded-2xl border border-line bg-surface px-5 py-4 text-sm text-muted">
          {shops.length
            ? `Alcanzaste tu límite de ${limitLabel}. Contacta a administración si necesitas otra.`
            : "Aún no puedes crear tiendas. Administración puede ampliar tu límite cuando lo necesites."}
        </p>
      ) : null}

      {shops.length ? (
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {shops.map((entry) => {
            const { shop } = entry;
            const imageUrl = shop.image_path ? (imageUrls.get(shop.image_path) ?? null) : null;
            return (
              <li className="rounded-[1.5rem] border border-line bg-surface p-4" key={shop.id}>
                <Link className="group flex items-center gap-4" href={`/panel/tiendas/${shop.id}`}>
                  <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-photo-backdrop">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" className="size-full object-cover" src={imageUrl} />
                    ) : (
                      <Store aria-hidden="true" className="size-6 text-brand/40" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-display text-lg font-semibold group-hover:text-brand">{shop.name}</span>
                      {shop.is_premium ? <PremiumBadge showDetails={false} /> : null}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {listingsLoaded ? `${entry.publishedQuotaCount} de ${shop.listing_limit} publicaciones` : "Publicaciones sin cargar"}
                      {" · "}Nivel {getTrustTierMarker(shop.trust_tier).label}
                    </span>
                    {entry.approval !== "approved" ? (
                      <span className="mt-1 block text-xs font-semibold text-sale">
                        {entry.approval === "pending" ? "Esperando aprobación de administración" : "Deshabilitada por administración"}
                      </span>
                    ) : null}
                  </span>
                </Link>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-sm font-semibold">
                  <Link className="tap inline-flex items-center text-brand" href={`/panel/tiendas/${shop.id}`}>Catálogo</Link>
                  <Link className="tap inline-flex items-center gap-1.5 text-brand" href={`/panel/tiendas/${shop.id}/ajustes`}>
                    <Settings aria-hidden="true" className="size-4" />
                    Ajustes
                  </Link>
                  <Link className="tap inline-flex items-center gap-1.5 text-brand" href={`/tiendas/${shop.slug}`}>
                    <ExternalLink aria-hidden="true" className="size-4" />
                    Tienda pública
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
