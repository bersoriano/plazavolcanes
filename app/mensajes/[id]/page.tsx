import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { MessageThread } from "@/components/messages/message-thread";
import { ThreadContext } from "@/components/messages/thread-context";
import { sendMessage } from "@/lib/actions/messages";
import { fetchThread } from "@/lib/queries/messages.server";

export default async function MessageThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversationId = Number(id);
  if (!Number.isInteger(conversationId)) notFound();

  const thread = await fetchThread(conversationId);
  // A thread the caller does not participate in reads as missing rather than
  // as forbidden, so its existence is never disclosed.
  if (!thread) notFound();

  const action = sendMessage.bind(null, thread.id, [`/mensajes/${thread.id}`, "/mensajes"]);

  return (
    <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-brand" href="/mensajes">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Mensajes
      </Link>

      <h1 className="mt-5 font-display text-3xl font-semibold">{thread.counterpart_label}</h1>
      <ThreadContext
        orderHref={
          thread.order_id
            ? thread.viewer_role === "seller"
              ? `/panel/pedidos/${thread.order_id}`
              : `/compras/${thread.order_id}`
            : null
        }
        orderId={thread.order_id}
        product={thread.product}
        shopName={thread.shop_name}
        shopSlug={thread.shop_slug}
      />

      <div className="mt-7">
        <MessageThread
          action={action}
          conversationId={thread.id}
          currentUserId={thread.current_user_id}
          messages={thread.messages}
        />
      </div>
    </section>
  );
}
