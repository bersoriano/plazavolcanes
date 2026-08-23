import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ConversationList } from "@/components/messages/conversation-list";
import { listConversations } from "@/lib/queries/messages.server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Mensajes de tu tienda" };

export default async function SellerInboxPage() {
  // The panel layout already refuses a visitor without a session.
  if (!isSupabaseConfigured()) return null;

  const conversations = await listConversations("seller");

  return (
    <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-brand" href="/panel">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Mi panel
      </Link>

      <p className="mt-7 text-sm font-semibold uppercase tracking-[0.18em] text-brand">Tus conversaciones</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em]">Mensajes de tu tienda</h1>
      <ConversationList basePath="/panel/mensajes" conversations={conversations} />
    </section>
  );
}
