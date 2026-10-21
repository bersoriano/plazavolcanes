import { redirect } from "next/navigation";

import { PanelNav } from "@/components/layout/panel-nav";
import { ButtonLink } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return (
      <section className="mx-auto max-w-3xl px-5 py-20 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Configuración pendiente</p>
        <h1 className="mt-3 font-display text-4xl font-semibold">Conecta Supabase para abrir tu panel</h1>
        <p className="mx-auto mt-4 max-w-xl leading-7 text-muted">Copia `.env.example` a `.env.local` y agrega la URL y llave pública de tu proyecto.</p>
        <ButtonLink  className="mt-7 bg-brand px-6 py-3 text-white" href="/">Volver a la plaza</ButtonLink>
      </section>
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/ingresar?continuar=/panel");

  // Opening the panel is itself a sign of presence, and the RPC throttles the write.
  // A failure here must never keep somebody out of their own panel.
  try {
    await supabase.rpc("touch_user_activity");
  } catch {
    // Presence is decoration; the panel matters more.
  }

  // Drawn here, once, for every page below. A layout does not render again on
  // navigation, so the bar asks for nothing and marks its place from the path.
  return (
    <>
      <PanelNav />
      {children}
    </>
  );
}
