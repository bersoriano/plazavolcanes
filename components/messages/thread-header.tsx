import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { STICK_UNDER_HEADER } from "@/components/messages/inbox-layout";
import { ThreadContext } from "@/components/messages/thread-context";
import type { Thread } from "@/lib/queries/messages";

/**
 * Who the open conversation is with, which side of it the reader is on, and
 * what it is about. Below `lg` the list is another screen, so this is also the
 * way back to it.
 */
export function ThreadHeader({ thread }: { thread: Thread }) {
  const selling = thread.viewer_role === "seller";

  return (
    <header
      className={`${STICK_UNDER_HEADER} shrink-0 border-b border-line bg-surface px-4 py-3 sm:px-6`}
    >
      <div className="flex items-center gap-1">
        <Link
          aria-label="Volver a mensajes"
          className="-ml-2 grid size-11 shrink-0 place-items-center rounded-full text-brand transition-colors hover:bg-background lg:hidden"
          href="/mensajes"
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>

        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-semibold tracking-[-0.02em]">
            {thread.counterpart_label}
          </h1>
          <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-brand">
            {selling ? ["Venta", thread.shop_name].filter(Boolean).join(" · ") : "Compra"}
          </p>
        </div>
      </div>

      <ThreadContext
        orderHref={
          thread.order_id
            ? selling
              ? `/panel/pedidos/${thread.order_id}`
              : `/compras/${thread.order_id}`
            : null
        }
        orderId={thread.order_id}
        orderItem={thread.order_item}
        product={thread.product}
        shopName={thread.shop_name}
        shopSlug={thread.shop_slug}
      />
    </header>
  );
}
