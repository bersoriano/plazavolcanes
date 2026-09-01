import Link from "next/link";

import { requireAdmin } from "@/lib/admin-auth.server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <>
      <nav aria-label="Administración" className="mx-auto flex max-w-6xl gap-2 px-5 pt-6 sm:px-8">
        <Link className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-brand" href="/admin/usuarios">
          Usuarios
        </Link>
        <Link className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-brand" href="/admin/disputas">
          Disputas
        </Link>
      </nav>
      {children}
    </>
  );
}
