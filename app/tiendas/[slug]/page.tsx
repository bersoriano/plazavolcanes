import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ChevronDown, MapPin, ShieldCheck, Store, Truck } from "lucide-react";
import { notFound } from "next/navigation";

import { ProductCard } from "@/components/catalog/product-card";
import { ProductGrid } from "@/components/catalog/product-grid";
import { pageContainer } from "@/components/layout/container";
import { ShareActions } from "@/components/share/share-actions";
import { StartConversationButton } from "@/components/messages/start-conversation-button";
import { FounderBadge } from "@/components/shops/founder-badge";
import { PremiumBadge } from "@/components/shops/premium-badge";
import { PremiumScope } from "@/components/shops/premium-scope";
import { TrustTierBadge } from "@/components/shops/trust-tier-badge";
import { EarnedSignals, TrustBadges } from "@/components/shops/trust-badges";
import { EmptyState } from "@/components/ui/empty-state";
import { openConversation } from "@/lib/actions/start-conversation";
import { getPublicShop } from "@/lib/queries/catalog.server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatShopLocation } from "@/lib/shop-location";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getPublicShop(slug);
  return shop ? { title: shop.name, description: shop.description } : { title: "Tienda no encontrada" };
}

export default async function PublicShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await getPublicShop(slug);
  if (!shop) notFound();

  // A shop row from before the column existed reads as not premium.
  const isPremium = shop.is_premium === true;

  let viewerId: string | null = null;
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getClaims();
    viewerId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  }

  // A shop page opens the general enquiry: no product is ever attached here.
  const messageAction = openConversation.bind(null, shop.id, null, null);

  const trustProfile = shop.trust_profile ? { joinedOn: shop.trust_profile.joined_on } : null;
  const isDistinguished = isPremium || Boolean(shop.founder_since);

  return (
    <PremiumScope className="pb-4" premium={isPremium}>
      <section className={`${pageContainer} py-4 sm:py-6`}>
        <Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand" href="/">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Volver a la plaza
        </Link>

        {/* The storefront's sign: the name sits on the seller's own photo, so
            the products can start a screen sooner. */}
        <div
          className={`relative mt-2 overflow-hidden rounded-[1.25rem] sm:rounded-[2rem] ${
            shop.imageUrl ? "bg-photo-backdrop" : "bg-brand"
          } ${isPremium ? "aspect-[16/8] sm:aspect-[4/1] lg:aspect-[5/1]" : "aspect-[16/7] sm:aspect-[5/1] lg:aspect-[6/1]"}`}
        >
          {shop.imageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" className="absolute inset-0 size-full object-cover" src={shop.imageUrl} />
              <div aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-black/70 via-black/15 to-transparent" />
            </>
          ) : null}
          {/* White on the photo in either theme; on the bare band, the ink
              that the brand colour carries in each theme. */}
          <h1
            className={`absolute inset-x-5 bottom-4 line-clamp-2 font-display text-3xl font-semibold sm:inset-x-8 sm:bottom-6 sm:text-5xl ${
              shop.imageUrl ? "text-white" : "text-on-brand"
            } ${isPremium ? "tracking-[-0.02em]" : "tracking-[-0.04em]"}`}
          >
            {shop.name}
          </h1>
        </div>

        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
          <div className="min-w-0 max-w-2xl">
            {/* Relative: on a phone the Premium tooltip hangs from this row's
                edge rather than from the badge, so it stays on screen. */}
            <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2">
              <TrustTierBadge className="" tier={shop.trust_tier} />
              {shop.founder_since ? <FounderBadge /> : null}
              {isPremium ? <PremiumBadge /> : null}
              <p className="flex items-center gap-1.5 text-sm font-semibold text-brand">
                <MapPin aria-hidden="true" className="size-4" />
                {formatShopLocation(shop.country_code, shop.administrative_area_codes)}
              </p>
            </div>
            {shop.description ? (
              <p className="mt-3 text-base leading-7 text-muted">{shop.description}</p>
            ) : null}
            <EarnedSignals className="mt-3" metrics={shop.trust_metrics} profile={trustProfile} />

            {/* The seller's terms and every signal the plaza measures, folded
                one tap away so they never stand between a buyer and the
                products. */}
            <details className="group mt-2">
              <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-brand">
                {shop.delivery_policy ? (
                  <Truck aria-hidden="true" className="size-4" />
                ) : (
                  <ShieldCheck aria-hidden="true" className="size-4" />
                )}
                {shop.delivery_policy ? "Entregas y señales de confianza" : "Señales de confianza"}
                <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-2 rounded-2xl border border-line bg-surface p-5 sm:p-6">
                {shop.delivery_policy ? (
                  <section aria-labelledby="delivery-policy-title" className="mb-6">
                    <h2
                      className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-brand"
                      id="delivery-policy-title"
                    >
                      Política de entregas
                    </h2>
                    <p className="mt-3 whitespace-pre-line text-base leading-7 text-muted">
                      {shop.delivery_policy}
                    </p>
                  </section>
                ) : null}
                <TrustBadges className="" metrics={shop.trust_metrics} profile={trustProfile} />
                <p className="mt-3 text-xs text-muted">
                  Estas son todas las señales que Plaza Volcanes mide para cada tienda. Nadie puede editar
                  sus propias métricas.
                </p>
              </div>
            </details>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <StartConversationButton
              action={messageAction}
              isOwnShop={viewerId === shop.owner_id}
              returnTo={`/tiendas/${shop.slug}`}
              signedIn={Boolean(viewerId)}
            />
            <ShareActions label="Compartir tienda" title={shop.name} />
          </div>
        </div>

        <div aria-hidden="true" className={`mt-5 sm:mt-6 ${isDistinguished ? "gold-rule" : "h-px bg-line"}`} />
        <h2 className="mb-4 mt-5 flex items-baseline gap-2 font-display text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
          Productos
          {shop.products.length ? (
            <span className="font-sans text-base font-semibold tracking-normal text-muted tabular-nums">
              {shop.products.length}
            </span>
          ) : null}
        </h2>
        <ProductGrid>
          {shop.products.length ? (
            shop.products.map((product) => <ProductCard key={product.id} product={product} showShop={false} />)
          ) : (
            <EmptyState
              icon={<Store aria-hidden="true" className="size-7" />}
              title="Esta tienda prepara su catálogo"
              description="Vuelve pronto para descubrir sus productos."
            />
          )}
        </ProductGrid>
      </section>
    </PremiumScope>
  );
}
