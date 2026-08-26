import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PasswordForm } from "@/components/auth/password-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default async function NewPasswordPage() {
  // The recovery link, not this page, is what proves who is asking. Arriving
  // without the session it establishes means the link was spent or expired, and
  // an empty form would only fail on submit.
  if (!isSupabaseConfigured()) redirect("/ingresar?error=configuracion");

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) redirect("/ingresar?error=recuperacion");

  return (
    <>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Casi listo</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em] text-ink">
        Elige tu contraseña
      </h1>
      <p className="mb-8 mt-3 leading-7 text-muted">
        Escríbela dos veces y volverás a tu plaza con la sesión abierta.
      </p>
      <PasswordForm mode="update" />
    </>
  );
}
