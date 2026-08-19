import Link from "next/link";
import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return (
      <section className="mx-auto max-w-3xl px-5 py-20 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Configuración pendiente</p>
        <h1 className="mt-3 font-display text-4xl font-semibold">Conecta Supabase para abrir tu panel</h1>
        <p className="mx-auto mt-4 max-w-xl leading-7 text-muted">Copia `.env.example` a `.env.local` y agrega la URL y llave pública de tu proyecto.</p>
        <Link className="mt-7 inline-flex rounded-full bg-brand px-6 py-3 font-semibold text-white" href="/">Volver a la plaza</Link>
      </section>
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/ingresar?continuar=/panel");

  return <>{children}</>;
}
