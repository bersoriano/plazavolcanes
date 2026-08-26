import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Where a password recovery e-mail lands.
 *
 * Supabase sends either a `code` or a `token_hash`, depending on how the link
 * was built, and both end the same way: a session exists, and the person still
 * has to choose a password. Signing them straight into the panel would leave
 * the old password in place.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/ingresar?error=configuracion", url));
  }

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const supabase = await createServerSupabaseClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL("/nueva-contrasena", url));
    }
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      return NextResponse.redirect(new URL("/nueva-contrasena", url));
    }
  }

  return NextResponse.redirect(new URL("/ingresar?error=recuperacion", url));
}
