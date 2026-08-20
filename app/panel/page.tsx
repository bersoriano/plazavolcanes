import Link from "next/link";
import { PackageOpen, Plus, Store } from "lucide-react";

import { ShopCard } from "@/components/shops/shop-card";
import { EmptyState } from "@/components/ui/empty-state";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function PanelPage() {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabaseClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  const { data: shops } = await supabase
    .from("shops")
    .select("*")
    .eq("owner_id", userId ?? "")
    .order("created_at", { ascending: false });

  return (
    <section className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8 sm:py-14">
      <div className="mb-9 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Tu espacio</p><h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Mis tiendas</h1><p className="mt-3 text-muted">Crea escaparates y mantén tus publicaciones al día.</p></div>
        <div className="flex flex-wrap gap-3"><Link className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 py-3 text-sm font-semibold text-brand transition-colors hover:border-brand" href="/panel/pedidos"><PackageOpen aria-hidden="true" className="size-4" />Pedidos</Link><Link className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-hover" href="/panel/tiendas/nueva"><Plus aria-hidden="true" className="size-4" />Crear tienda</Link></div>
      </div>

      {shops?.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{shops.map((shop) => <ShopCard key={shop.id} shop={shop} />)}</div> : (
        <EmptyState icon={<Store aria-hidden="true" className="size-7" />} title="Tu primera tienda te espera" description="Dale nombre, cuenta su historia y empieza a publicar productos." action={<Link className="font-semibold text-brand underline decoration-accent decoration-4 underline-offset-4" href="/panel/tiendas/nueva">Crear mi primera tienda</Link>} />
      )}
    </section>
  );
}
