import { pageContainer } from "@/components/layout/container";
import { ButtonLink } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin-auth.server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <>
      <nav aria-label="Administración" className={`${pageContainer} flex flex-wrap gap-2 pt-6`}>
        <ButtonLink variant="unstyled" className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-brand" href="/admin/usuarios">
          Usuarios
        </ButtonLink>
        <ButtonLink variant="unstyled" className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-brand" href="/admin/disputas">
          Centro de Resoluciones
        </ButtonLink>
        <ButtonLink variant="unstyled" className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-brand" href="/admin/importaciones">
          Importaciones
        </ButtonLink>
        <ButtonLink variant="unstyled" className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-brand" href="/admin/avisos">
          Avisos
        </ButtonLink>
        <ButtonLink variant="unstyled" className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-brand" href="/admin/contacto">
          Contacto
        </ButtonLink>
      </nav>
      {children}
    </>
  );
}
