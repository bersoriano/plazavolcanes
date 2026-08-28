import Link from "next/link";
import { UsersRound } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/format";
import type { AdminMarketplaceUser } from "@/lib/queries/admin";

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
                  {shop.products.length ? (
                    <ul className="mt-4 divide-y divide-line">
                      {shop.products.map((product) => (
                        <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between" key={product.id}>
                          <div>
                            <h4 className="font-semibold">
                              {product.status === "published" ? (
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
                          <StatusBadge status={product.status} />
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
