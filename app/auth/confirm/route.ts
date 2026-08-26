import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { resumePurchaseIntent } from "@/lib/purchase-intent.server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/ingresar?error=configuracion", url));
  }

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const supabase = await createServerSupabaseClient();

  // Someone may have been buying when registration sent them to their inbox, so
  // a confirmed account lands on its cart rather than on the panel.
  async function confirmed() {
    const destination = (await resumePurchaseIntent(supabase)) ?? "/panel";
    return NextResponse.redirect(new URL(destination, url));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return confirmed();
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return confirmed();
  }

  return NextResponse.redirect(new URL("/ingresar?error=confirmacion", url));
}
