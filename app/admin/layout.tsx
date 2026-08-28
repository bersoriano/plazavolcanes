import Link from "next/link";
import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) redirect("/panel");
  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/ingresar?continuar=/admin/disputas");
  const { data: allowed } = await supabase.rpc("is_current_user_admin");
  if (!allowed) redirect("/panel");
  return (
    <>
      <nav aria-label="Administración" className="mx-auto flex max-w-6xl gap-2 px-5 pt-6 sm:px-8">
        <Link className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-brand" href="/admin/usuarios">
          Usuarios
        </Link>
        <Link className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-brand" href="/admin/disputas">
          Disputas
        </Link>
      </nav>
      {children}
    </>
  );
}
