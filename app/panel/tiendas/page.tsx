import Link from "next/link";
import { RotateCw, Store } from "lucide-react";
import { redirect } from "next/navigation";

import { pageContainer } from "@/components/layout/container";
import { ShopOverview } from "@/components/seller-dashboard/shop-overview";
import { EmptyState } from "@/components/ui/empty-state";
import { getSellerShops } from "@/lib/queries/shops.server";

export const metadata = { title: "Mis tiendas — Plaza Volcanes" };

/**
 * Where "Tiendas" in the panel's bar leads: every shop the seller has, and the
 * way to open another.
 */
export default async function ShopsPage() {
  const result = await getSellerShops();
  if (!result) return null;

  if (result.status === "error") {
    return (
      <section className={`${pageContainer} py-10 sm:py-14`}>
        <div className="rounded-[2rem] border border-line bg-surface p-6 sm:p-8" role="alert">
          <h1 className="font-display text-2xl font-semibold">No pudimos cargar tus tiendas</h1>
          <p className="mt-2 max-w-xl leading-7 text-muted">
            Tus tiendas y productos no cambiaron; solo falló la consulta. Vuelve a intentarlo en un momento.
          </p>
          <Link className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-on-brand" href="/panel/tiendas">
            <RotateCw aria-hidden="true" className="size-4" />
            Reintentar
          </Link>
        </div>
      </section>
    );
  }

  const { shops, canCreateShop } = result;

  // Most sellers have one shop and a limit of one. A list of one with nothing
  // else to do on it is a tap that only stands between them and their
  // products. With room for another shop the list stays: it is the way there.
  if (shops.length === 1 && !canCreateShop) redirect(`/panel/tiendas/${shops[0].shop.id}`);

  return (
    <section className={`${pageContainer} py-10 sm:py-14`}>
      <ShopOverview
        canCreateShop={canCreateShop}
        headingLevel={1}
        imageUrls={result.imageUrls}
        listingsLoaded={result.listingsLoaded}
        shopLimit={result.shopLimit}
        shops={shops}
      />
      {shops.length === 0 && canCreateShop ? (
        <div className="mt-6">
          <EmptyState
            action={
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand hover:bg-brand-hover"
                href="/panel/tiendas/nueva"
              >
                Crear tienda
              </Link>
            }
            description="Crea tu tienda para empezar a preparar tus productos."
            icon={<Store aria-hidden="true" className="size-7" />}
            title="Aún no tienes una tienda"
          />
        </div>
      ) : null}
    </section>
  );
}
