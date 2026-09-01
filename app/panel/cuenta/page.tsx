import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { DisplayNameForm } from "@/components/account/display-name-form";
import { PhoneForm } from "@/components/account/phone-form";
import { updateDisplayName, updatePhone } from "@/lib/actions/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "Mi cuenta — Plaza Volcanes" };

export default async function AccountPage() {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabaseClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  const email = typeof claimsData?.claims?.email === "string" ? claimsData.claims.email : null;
  const { data: contactDetails } = await supabase
    .from("user_contact_details")
    .select("phone")
    .eq("user_id", userId ?? "")
    .maybeSingle();
  const { data: displayName } = await supabase.rpc("my_display_name");

  return (
    <section className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
      <Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand" href="/panel">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Mi panel
      </Link>

      <div className="mt-7 rounded-[2rem] border border-line bg-surface p-6 sm:p-9">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Tu cuenta</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em]">Datos de contacto</h1>
        {email ? <p className="mb-8 mt-3 leading-7 text-muted">Tu cuenta usa {email}.</p> : null}

        <DisplayNameForm action={updateDisplayName} displayName={displayName ?? null} />

        <div className="mt-8 border-t border-line pt-8">
          <PhoneForm action={updatePhone} phone={contactDetails?.phone ?? null} />
        </div>
      </div>
    </section>
  );
}
