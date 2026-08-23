import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ConversationList } from "@/components/messages/conversation-list";
import { listConversations } from "@/lib/queries/messages.server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mensajes" };

export default async function BuyerInboxPage() {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/ingresar?continuar=/mensajes");

  const conversations = await listConversations("buyer");

  return (
    <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Tus conversaciones</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em]">Mensajes</h1>
      <ConversationList basePath="/mensajes" conversations={conversations} />
    </section>
  );
}
