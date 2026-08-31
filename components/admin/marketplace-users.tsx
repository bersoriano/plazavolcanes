"use client";

import Link from "next/link";
import { UsersRound } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { setShopPublishingApproval } from "@/lib/actions/admin-publication";
import { formatDate } from "@/lib/format";
import type {
  AdminMarketplaceProductState,
  AdminMarketplaceShop,
  AdminMarketplaceUser,
} from "@/lib/queries/admin";
import { useFormAction } from "@/lib/use-form-action";

const productStateStyles: Record<
  AdminMarketplaceProductState,
  { label: string; className: string }
> = {
  draft: { label: "Borrador", className: "bg-background text-muted" },
  pending: { label: "Pendiente de aprobación", className: "bg-background text-muted" },
  public: { label: "Publicado", className: "bg-accent text-brand-hover" },
  "admin-disabled": {
    label: "Deshabilitado por administración",
    className: "bg-sale/15 text-sale",
  },
  expired: { label: "Vencido", className: "bg-sale/15 text-sale" },
};

function AdminProductStateBadge({ state }: { state: AdminMarketplaceProductState }) {
  const { label, className } = productStateStyles[state];
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${className}`}>
      {label}
    </span>
  );
}

function ShopPublishingApproval({ shop }: { shop: AdminMarketplaceShop }) {
  const [state, formAction, pending] = useFormAction(setShopPublishingApproval);
  const appliedValue = state.status === "success" ? state.values?.enabled : undefined;
  const isApproved =
    appliedValue === "true"
      ? true
      : appliedValue === "false"
        ? false
        : shop.isPublishingApproved;

  return (
    <form action={formAction} className="mt-4 rounded-2xl border border-line bg-surface p-4">
      <input name="shop_id" type="hidden" value={shop.id} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            {isApproved ? "Publicaciones habilitadas" : "Publicaciones pendientes"}
          </p>
          <p className="mt-1 text-sm text-muted">
            Deshabilitar la tienda oculta sus productos sin cambiar las decisiones del vendedor.
          </p>
        </div>
        <button
          aria-checked={isApproved}
          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition ${
            isApproved ? "bg-success" : "bg-line"
          }`}
          disabled={pending}
          name="enabled"
          role="switch"
          type="submit"
          value={String(!isApproved)}
        >
          <span className="sr-only">Publicaciones habilitadas</span>
          <span
            aria-hidden="true"
            className={`size-6 rounded-full bg-white shadow transition-transform ${
              isApproved ? "translate-x-7" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      {state.message ? (
        <p
          className={`mt-3 text-sm ${state.status === "error" ? "text-sale" : "text-success"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function MarketplaceUsers({ users }: { users: AdminMarketplaceUser[] }) {
  if (!users.length) {
    return (
      <EmptyState
        icon={<UsersRound aria-hidden="true" className="size-7" />}
        title="No hay personas registradas"
        description="Las cuentas nuevas aparecerán aquí."
      />
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <p className="text-sm text-muted">
        {users.length} {users.length === 1 ? "persona registrada" : "personas registradas"}
      </p>
      {users.map((user) => (
        <article className="rounded-[2rem] border border-line bg-surface p-6 sm:p-8" key={user.id}>
          <h2 className="font-display text-2xl font-semibold">
            {user.displayName ?? user.email ?? "Cuenta sin nombre"}
          </h2>
          <p className="mt-1 text-sm text-muted">{user.email ?? "Sin correo registrado"}</p>
          <p className="mt-1 text-sm text-muted">Registro: {formatDate(user.createdAt)}</p>
          {user.shops.length ? (
            <div className="mt-6 space-y-4">
              {user.shops.map((shop) => (
                <section className="rounded-2xl bg-background p-5" key={shop.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-xl font-semibold">
                        <Link className="text-brand underline-offset-4 hover:underline" href={`/tiendas/${shop.slug}`}>
                          {shop.name}
                        </Link>
                      </h3>
                      <p className="mt-1 text-sm text-muted">Creada: {formatDate(shop.createdAt)}</p>
                    </div>
                  </div>
                  <ShopPublishingApproval
                    key={`${shop.id}:${shop.isPublishingApproved}`}
                    shop={shop}
                  />
                  {shop.products.length ? (
                    <ul className="mt-4 divide-y divide-line">
                      {shop.products.map((product) => (
                        <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between" key={product.id}>
                          <div>
                            <h4 className="font-semibold">
                              {product.effectiveVisibility ? (
                                <Link className="text-brand underline-offset-4 hover:underline" href={`/productos/${product.slug}`}>
                                  {product.name}
                                </Link>
                              ) : (
                                <span>{product.name}</span>
                              )}
                            </h4>
                            <p className="mt-1 text-xs text-muted">
                              Creado: {formatDate(product.createdAt)} · Actualizado: {formatDate(product.updatedAt)}
                            </p>
                          </div>
                          <AdminProductStateBadge state={product.state} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 text-sm text-muted">Sin borradores ni publicaciones</p>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <p className="mt-6 rounded-2xl bg-background p-5 text-sm text-muted">Sin tiendas</p>
          )}
        </article>
      ))}
    </div>
  );
}
