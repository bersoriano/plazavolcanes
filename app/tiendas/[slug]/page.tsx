import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MapPin, Store } from "lucide-react";
import { notFound } from "next/navigation";

import { ProductCard } from "@/components/catalog/product-card";
import { ProductGrid } from "@/components/catalog/product-grid";
import { ShareActions } from "@/components/share/share-actions";
import { StartConversationButton } from "@/components/messages/start-conversation-button";
import { TrustTierBadge } from "@/components/shops/trust-tier-badge";
import { TrustBadges } from "@/components/shops/trust-badges";
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

  let viewerId: string | null = null;
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getClaims();
    viewerId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  }

  // A shop page opens the general enquiry: no product is ever attached here.
  const messageAction = openConversation.bind(null, shop.id, null);

  return (
    <section className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-brand" href="/">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Volver a la plaza
      </Link>

      <div className="mt-7 overflow-hidden rounded-[2rem] border border-line bg-surface">
        <div className="relative aspect-[4/1] min-h-40 bg-[#eee8e1]">
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
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <h1 className="font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
              {shop.name}
            </h1>
            <TrustTierBadge tier={shop.trust_tier} />
          </div>
          <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-brand">
            <MapPin aria-hidden="true" className="size-4" />
            {formatShopLocation(shop.country_code, shop.administrative_area_codes)}
          </p>
          <p className="mt-4 max-w-2xl text-base leading-8 text-muted">{shop.description}</p>

          <TrustBadges
            metrics={shop.trust_metrics}
            profile={
              shop.trust_profile ? { joinedOn: shop.trust_profile.joined_on } : null
            }
          />
          <p className="mt-3 text-xs text-muted">
            Estas son todas las señales que Plaza Volcanes mide para cada tienda. Nadie puede editar
            sus propias métricas.
          </p>

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
  );
}
