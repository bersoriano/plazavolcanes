import type { Metadata } from "next";
import { ShoppingBag, Store } from "lucide-react";
import { redirect } from "next/navigation";

import { ConversationList } from "@/components/messages/conversation-list";
import { listConversations } from "@/lib/queries/messages.server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mensajes" };

export default async function MessagesPage() {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/ingresar?continuar=/mensajes");
  const userId = typeof data.claims.sub === "string" ? data.claims.sub : null;
  if (!userId) redirect("/ingresar?continuar=/mensajes");

  const [shoppingConversations, sellingConversations, { data: ownedShops }] = await Promise.all([
    listConversations("buyer"),
    listConversations("seller"),
    supabase.from("shops").select("id").eq("owner_id", userId).limit(1),
  ]);
  const ownsShop = Boolean(ownedShops?.length);
  const sellingUnread = sellingConversations.reduce(
    (total, conversation) => total + conversation.unread_count,
    0,
  );
  const shoppingUnread = shoppingConversations.reduce(
    (total, conversation) => total + conversation.unread_count,
    0,
  );

  return (
    <section className="mx-auto max-w-[1280px] px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Tu buzón</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
        Mensajes
      </h1>
      <p className="mt-3 max-w-2xl text-muted">
        Mantén separadas las conversaciones de lo que vendes y lo que compras.
      </p>

      <div
        className={
          ownsShop
            ? "mt-10 grid gap-10 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-line"
            : "mt-10 max-w-3xl"
        }
      >
        {ownsShop ? (
          <section
            aria-labelledby="selling-inbox-title"
            className="min-w-0 lg:pr-8 xl:pr-12"
          >
            <div className="flex items-start justify-between gap-4 border-b border-line pb-5">
              <div className="flex min-w-0 items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand text-white">
                  <Store aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
                    Vendes
                  </p>
                  <h2
                    className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em]"
                    id="selling-inbox-title"
                  >
                    Mis tiendas y publicaciones
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Consultas y pedidos recibidos en tus tiendas.
                  </p>
                </div>
              </div>
              {sellingUnread > 0 ? (
                <span className="shrink-0 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white">
                  {sellingUnread} sin leer
                </span>
              ) : null}
            </div>
            <ConversationList
              basePath="/mensajes"
              conversations={sellingConversations}
              emptyMessage="Las consultas sobre tus tiendas aparecerán aquí."
            />
          </section>
        ) : null}

        <section
          aria-labelledby="shopping-inbox-title"
          className={ownsShop ? "min-w-0 lg:pl-8 xl:pl-12" : "min-w-0"}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line pb-5">
            <div className="flex min-w-0 items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-brand-hover">
                <ShoppingBag aria-hidden="true" className="size-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
                  Compras
                </p>
                <h2
                  className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em]"
                  id="shopping-inbox-title"
                >
                  Mis compras
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Preguntas y seguimiento de tus compras.
                </p>
              </div>
            </div>
            {shoppingUnread > 0 ? (
              <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-brand-hover">
                {shoppingUnread} sin leer
              </span>
            ) : null}
          </div>
          <ConversationList
            basePath="/mensajes"
            conversations={shoppingConversations}
            emptyMessage="Tus preguntas y solicitudes de compra aparecerán aquí."
          />
        </section>
      </div>
    </section>
  );
}
