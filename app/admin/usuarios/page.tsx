import { MarketplaceUsers } from "@/components/admin/marketplace-users";
import { requireAdmin } from "@/lib/admin-auth.server";
import { getAdminMarketplaceUsers } from "@/lib/queries/admin.server";

export default async function AdminUsersPage() {
  await requireAdmin();
  const users = await getAdminMarketplaceUsers();

  return (
    <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Administración</p>
      <h1 className="mt-2 font-display text-4xl font-semibold">Usuarios y publicaciones</h1>
      <p className="mt-3 max-w-2xl leading-7 text-muted">
        Consulta cuentas registradas, sus tiendas y publicaciones activas o en borrador.
      </p>
      <MarketplaceUsers users={users} />
    </section>
  );
}
