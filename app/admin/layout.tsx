import Link from "next/link";

import { pageContainer } from "@/components/layout/container";
import { requireAdmin } from "@/lib/admin-auth.server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <>
      <nav aria-label="Administración" className={`${pageContainer} flex gap-2 pt-6`}>
        <Link className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-brand" href="/admin/usuarios">
          Usuarios
        </Link>
        <Link className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-brand" href="/admin/disputas">
          Disputas
        </Link>
        <Link className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-brand" href="/admin/importaciones">
          Importaciones
        </Link>
      </nav>
      {children}
    </>
  );
}
