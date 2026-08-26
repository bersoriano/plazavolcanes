import Link from "next/link";
import { ImageIcon } from "lucide-react";

import { formatCurrency } from "@/lib/format";
import type { ConversationProduct } from "@/lib/queries/messages";

const CARD =
  "mt-4 flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors";

function ProductCardBody({ product }: { product: ConversationProduct }) {
  return (
    <>
      <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#eee8e1]">
        {product.image_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img alt={product.name} className="size-full object-cover" src={product.image_url} />
        ) : (
          <ImageIcon aria-hidden="true" className="size-7 text-brand/30" />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ink">{product.name}</span>
        <span className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
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
 * What the conversation is about, above the messages: the listing as it stands
 * now, the shop for a general enquiry, or the order for an order thread.
 */
export function ThreadContext({
  orderHref,
  orderId,
  product,
  shopName,
  shopSlug,
}: {
  orderHref: string | null;
  orderId: number | null;
  product: ConversationProduct | null;
  shopName: string;
  shopSlug: string;
}) {
  if (orderId && orderHref) {
    return (
      <Link className="mt-2 inline-flex text-sm font-semibold text-brand" href={orderHref}>
        Ver el pedido #{orderId}
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
    <p className="mt-2 text-sm text-muted">
      Consulta general{shopSlug ? " · " : ""}
      {shopSlug ? (
        <Link className="font-semibold text-brand" href={`/tiendas/${shopSlug}`}>
          {shopName}
        </Link>
      ) : null}
    </p>
  );
}
