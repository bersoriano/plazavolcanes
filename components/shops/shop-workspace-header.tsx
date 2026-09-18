import Link from "next/link";
import { ArrowLeft, ExternalLink, PackageOpen } from "lucide-react";

import { PremiumBadge } from "@/components/shops/premium-badge";
import { PREMIUM_SUMMARY } from "@/lib/seller-standing";

type WorkspaceView = "catalogo" | "ajustes";

const VIEWS: { id: WorkspaceView; label: string; segment: string }[] = [
  { id: "catalogo", label: "Catálogo", segment: "" },
  { id: "ajustes", label: "Ajustes", segment: "/ajustes" },
];

/**
 * The lid on both halves of a shop's workspace.
 *
 * The catalogue and the settings are separate routes so neither crowds the
 * other, and this header is what keeps them feeling like one place: same name,
 * same two tabs, same way out to the public shop and to the day's orders.
 */
export function ShopWorkspaceHeader({
  active,
  isPremium = false,
  shopId,
  shopName,
  shopSlug,
}: {
  active: WorkspaceView;
  isPremium?: boolean;
  shopId: number;
  shopName: string;
  shopSlug: string;
}) {
  return (
    <header className="mb-7">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Link className="tap inline-flex items-center gap-2 text-sm font-semibold text-brand" href="/panel">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Mis tiendas
        </Link>
        <div className="flex flex-wrap items-center gap-x-4">
          <Link className="tap inline-flex items-center gap-2 text-sm font-semibold text-brand" href="/panel/pedidos">
            <PackageOpen aria-hidden="true" className="size-4" />
            Pedidos
          </Link>
          <Link className="tap inline-flex items-center gap-2 text-sm font-semibold text-brand" href={`/tiendas/${shopSlug}`}>
            <ExternalLink aria-hidden="true" className="size-4" />
            Ver tienda pública
          </Link>
        </div>
      </div>

      <p className="mt-4 text-sm font-semibold uppercase tracking-[0.16em] text-brand">Tu tienda</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{shopName}</h1>
        {isPremium ? <PremiumBadge /> : null}
      </div>
      {isPremium ? (
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          {PREMIUM_SUMMARY} Tu tienda pública, tus productos y tu ficha en el catálogo se
          muestran destacados. Tu historial de ventas se mide aparte, abajo.
        </p>
      ) : null}

      {/* Underlined tabs rather than pills: the catalogue's own filters are
          pills, and two rows of pills would read as one flat set of choices. */}
      <nav aria-label="Secciones de la tienda" className="mt-6 border-b border-line">
        <ul className="-mb-px flex gap-6">
          {VIEWS.map((view) => {
            const isOpen = view.id === active;

            return (
              <li key={view.id}>
                <Link
                  aria-current={isOpen ? "page" : undefined}
                  className={`tap inline-flex items-center border-b-2 pb-3 text-sm font-semibold transition-colors ${
                    isOpen ? "border-brand text-brand" : "border-transparent text-muted hover:text-brand"
                  }`}
                  href={`/panel/tiendas/${shopId}${view.segment}`}
                >
                  {view.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
