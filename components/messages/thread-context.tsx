import Link from "next/link";
import { ImageIcon, Package } from "lucide-react";

import { formatCurrency } from "@/lib/format";
import {
  orderItemLabel,
  type ConversationOrderItem,
  type ConversationProduct,
} from "@/lib/queries/messages";

const CARD =
  "mt-3 flex items-center gap-3 rounded-2xl border border-line bg-background p-3 transition-colors";
const PICTURE =
  "grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-photo-backdrop";

function ProductCardBody({ product }: { product: ConversationProduct }) {
  return (
    <>
      <span className={PICTURE}>
        {product.image_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img alt={product.name} className="size-full object-cover" src={product.image_url} />
        ) : (
          <ImageIcon aria-hidden="true" className="size-6 text-brand/30" />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ink">{product.name}</span>
        <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-brand">
            {formatCurrency(product.price, product.currency_code)}
          </span>
          <span
            className={`text-xs font-semibold uppercase tracking-[0.14em] ${
              product.is_available ? "text-muted" : "text-sale"
            }`}
          >
            {product.is_available ? "Disponible" : "Ya no disponible"}
          </span>
        </span>
      </span>
    </>
  );
}

/**
 * What the conversation is about, above the messages: the order and what it
 * holds, the listing as it stands now, or the shop for a general enquiry.
 */
export function ThreadContext({
  orderHref,
  orderId,
  orderItem,
  product,
  shopName,
  shopSlug,
}: {
  orderHref: string | null;
  orderId: number | null;
  orderItem: ConversationOrderItem | null;
  product: ConversationProduct | null;
  shopName: string;
  shopSlug: string;
}) {
  if (orderId && orderHref) {
    return (
      <Link className={`${CARD} hover:border-brand`} href={orderHref}>
        <span className={PICTURE}>
          {orderItem?.image_url ? (
            // The line beside it already names what was bought.
            /* eslint-disable-next-line @next/next/no-img-element */
            <img alt="" className="size-full object-cover" src={orderItem.image_url} />
          ) : (
            <Package aria-hidden="true" className="size-6 text-brand/30" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          {orderItem ? (
            <span className="block truncate font-semibold text-ink">{orderItemLabel(orderItem)}</span>
          ) : null}
          <span className="block text-sm font-semibold text-brand">Ver el pedido #{orderId}</span>
        </span>
      </Link>
    );
  }

  if (product) {
    // A listing that left the plaza keeps its card and its history; only the link
    // goes, because the page behind it no longer exists.
    return product.href ? (
      <Link className={`${CARD} hover:border-brand`} href={product.href}>
        <ProductCardBody product={product} />
      </Link>
    ) : (
      <div className={CARD}>
        <ProductCardBody product={product} />
      </div>
    );
  }

  return (
    <p className="flex flex-wrap items-center gap-x-1 text-sm text-muted">
      Consulta general{shopSlug ? " ·" : ""}
      {shopSlug ? (
        <Link
          className="tap inline-flex items-center font-semibold text-brand"
          href={`/tiendas/${shopSlug}`}
        >
          {shopName}
        </Link>
      ) : null}
    </p>
  );
}
