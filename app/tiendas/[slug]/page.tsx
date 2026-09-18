import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MapPin, Store, Truck } from "lucide-react";
import { notFound } from "next/navigation";

import { ProductCard } from "@/components/catalog/product-card";
import { ProductGrid } from "@/components/catalog/product-grid";
import { ShareActions } from "@/components/share/share-actions";
import { StartConversationButton } from "@/components/messages/start-conversation-button";
import { PremiumScope } from "@/components/shops/premium-scope";
import { SellerBadges, SellerStanding } from "@/components/shops/seller-standing";
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

  return (
    <PremiumScope className="pb-4" premium={isPremium}>
      <section className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
        <Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand" href="/">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Volver a la plaza
        </Link>

        <div className="mt-7 overflow-hidden rounded-[2rem] border border-line bg-surface">
          <div
            className={`relative bg-photo-backdrop ${
              isPremium ? "aspect-[21/9] sm:aspect-[21/6] sm:min-h-48" : "aspect-[16/9] sm:aspect-[4/1] sm:min-h-40"
            }`}
          >
            {shop.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="size-full object-cover" src={shop.imageUrl} />
            ) : (
              <div className="grid size-full place-items-center text-brand/25">
                <Store aria-hidden="true" className="size-12" />
              </div>
            )}
          </div>

          <div className="p-7 sm:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
              Tienda independiente
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
              <h1
                className={`font-display text-4xl font-semibold sm:text-5xl ${
                  isPremium ? "tracking-[-0.02em]" : "tracking-[-0.04em]"
                }`}
              >
                {shop.name}
              </h1>
              <SellerBadges premium={isPremium} tier={shop.trust_tier} />
            </div>
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-brand">
              <MapPin aria-hidden="true" className="size-4" />
              {formatShopLocation(shop.country_code, shop.administrative_area_codes)}
            </p>
            {isPremium ? <div aria-hidden="true" className="gold-rule mt-6" /> : null}
            <p className="mt-4 max-w-2xl text-base leading-8 text-muted">{shop.description}</p>

            {/* The seller's own terms, in their own words, kept next to the
                description a buyer is already reading. */}
            {shop.delivery_policy ? (
              <section
                aria-labelledby="delivery-policy-title"
                className="mt-7 max-w-2xl rounded-2xl border border-line bg-background p-5 sm:p-6"
              >
                <h2
                  className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-brand"
                  id="delivery-policy-title"
                >
                  <Truck aria-hidden="true" className="size-4" />
                  Política de entregas
                </h2>
                <p className="mt-3 whitespace-pre-line text-base leading-8 text-muted">
                  {shop.delivery_policy}
                </p>
              </section>
            ) : null}

            <SellerStanding
              joinedOn={shop.trust_profile?.joined_on ?? null}
              metrics={shop.trust_metrics}
              premium={isPremium}
              profile={
                shop.trust_profile ? { joinedOn: shop.trust_profile.joined_on } : null
              }
            />

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <StartConversationButton
                action={messageAction}
                isOwnShop={viewerId === shop.owner_id}
                returnTo={`/tiendas/${shop.slug}`}
                signedIn={Boolean(viewerId)}
              />
              <ShareActions label="Compartir tienda" title={shop.name} />
            </div>
          </div>
        </div>

        <div className="mb-7 mt-12">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Escaparate</p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em]">
            Productos publicados
          </h2>
        </div>
        <ProductGrid>
          {shop.products.length ? (
            shop.products.map((product) => <ProductCard key={product.id} product={product} />)
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
