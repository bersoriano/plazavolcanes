import { NextResponse } from "next/server";

import { resolveAuthIntent } from "@/lib/auth-intent";
import { resumePurchaseIntent } from "@/lib/purchase-intent.server";
import { safeContinuation } from "@/lib/safe-continuation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const intent = resolveAuthIntent(url.searchParams.get("intent"), url.searchParams.get("vender"));

  function recovery(reason: string) {
    const params = new URLSearchParams({ error: reason });
    const continuation = safeContinuation(url.searchParams.get("continuar"));
    if (continuation) params.set("continuar", continuation);
    if (intent) params.set("intent", intent);
    // Never forward tokens, codes, provider messages or email addresses.
    return NextResponse.redirect(new URL(`/ingresar?${params}`, url));
  }

  if (!isSupabaseConfigured()) {
    return recovery("configuracion");
  }

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const supabase = await createServerSupabaseClient({ strictCookies: true });

  // Someone may have been buying when registration sent them to their inbox, so
  // a confirmed account lands on its cart rather than on the panel.
  async function confirmed() {
    const destination = (await resumePurchaseIntent(supabase))
      ?? safeContinuation(url.searchParams.get("continuar"))
      ?? (intent ? "/panel/tiendas/nueva" : "/panel");
    return NextResponse.redirect(new URL(destination, url));
  }

  if (code) {
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      // A code or an existing browser session is not proof that this link's
      // account is confirmed. Use the Auth server's exchange result only.
      if (error) return recovery("sesion_confirmacion");
      if (!data?.user?.email_confirmed_at) return recovery("confirmacion");
      if (!data.session) return recovery("sesion_confirmacion");
    } catch {
      return recovery("sesion_confirmacion");
    }
    return confirmed();
  }

  if (tokenHash && (type === "signup" || type === "email")) {
    try {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error || !data?.user?.email_confirmed_at) return recovery("confirmacion");
      if (!data.session) return recovery("sesion_confirmacion");
    } catch {
      // Verification may have completed before session persistence failed.
      // Without a result we cannot assert either email state.
      return recovery("sesion_confirmacion");
    }
    return confirmed();
  }

  return recovery("confirmacion");
}
