import Link from "next/link";
import { CircleUserRound, PackageOpen, Plus, Store } from "lucide-react";

import { ShopCard } from "@/components/shops/shop-card";
import { EmptyState } from "@/components/ui/empty-state";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mediaUrls } from "@/lib/media/url";

export default async function PanelPage() {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabaseClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  const [{ data: shops, count }, { data: limitData }] = await Promise.all([
    supabase
      .from("shops")
      .select("*", { count: "exact" })
      .eq("owner_id", userId ?? "")
      .order("created_at", { ascending: false }),
    supabase.rpc("current_user_shop_limit"),
  ]);
  const shopLimit = typeof limitData === "number" ? limitData : 1;
  const shopCount = typeof count === "number" ? count : (shops?.length ?? 0);
  const canCreateShop = shopCount < shopLimit;
  const limitLabel = `${shopLimit} ${shopLimit === 1 ? "tienda" : "tiendas"}`;
  const imageUrls = mediaUrls((shops ?? []).map((shop) => shop.image_path),
  );

  return (
    <section className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8 sm:py-14">
      <div className="mb-9 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Tu espacio</p><h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Mis tiendas</h1><p className="mt-3 text-muted">Crea escaparates y mantén tus publicaciones al día.</p></div>
        <div className="flex flex-wrap gap-3"><Link className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 py-3 text-sm font-semibold text-brand transition-colors hover:border-brand" href="/panel/cuenta"><CircleUserRound aria-hidden="true" className="size-4" />Mi cuenta</Link><Link className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 py-3 text-sm font-semibold text-brand transition-colors hover:border-brand" href="/panel/pedidos"><PackageOpen aria-hidden="true" className="size-4" />Pedidos</Link>{canCreateShop ? <Link className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-hover" href="/panel/tiendas/nueva"><Plus aria-hidden="true" className="size-4" />Crear tienda</Link> : null}</div>
      </div>

      {!canCreateShop ? (
        <p className="mb-6 rounded-2xl border border-line bg-surface px-5 py-4 text-sm text-muted">
          Alcanzaste tu límite de {limitLabel}. Contacta a administración si necesitas otra.
        </p>
      ) : null}

      {shops?.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{shops.map((shop) => <ShopCard key={shop.id} shop={{ ...shop, imageUrl: shop.image_path ? (imageUrls.get(shop.image_path) ?? null) : null }} />)}</div> : (
        <EmptyState icon={<Store aria-hidden="true" className="size-7" />} title={canCreateShop ? "Tu primera tienda te espera" : "Aún no puedes crear tiendas"} description={canCreateShop ? "Dale nombre, cuenta su historia y empieza a publicar productos." : "Administración puede ampliar tu límite cuando lo necesites."} action={canCreateShop ? <Link className="inline-flex min-h-11 items-center font-semibold text-brand underline decoration-accent decoration-4 underline-offset-4" href="/panel/tiendas/nueva">Crear mi primera tienda</Link> : undefined} />
      )}
    </section>
  );
}
