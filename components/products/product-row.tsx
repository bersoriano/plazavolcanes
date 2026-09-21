import Link from "next/link";
import { Edit3, ImageIcon, Trash2 } from "lucide-react";

import { ProductStatusAction } from "@/components/products/product-status-action";
import type { ListingStatus } from "@/components/ui/status-badge";
import { deleteProduct } from "@/lib/actions/products";
import { formatDate, formatMxn } from "@/lib/format";
import { getSellerPublicationState } from "@/lib/seller-publication";

type ProductRowProps = {
  product: {
    id: number;
    name: string;
    price_mxn: number;
    image_url: string | null;
    status: ListingStatus;
    expires_at: string | null;
    is_admin_enabled: boolean;
    is_publishing_approved: boolean;
    publishing_reviewed_at: string | null;
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** Close enough that the seller should renew it now rather than next visit. */
const EXPIRY_WARNING_DAYS = 7;

/**
 * What the row says about the listing's clock.
 *
 * A listing stops selling the moment it expires and nothing else announces it,
 * so the last week is counted down instead of dated: "Vence en 3 días" is a
 * thing to act on, "Vence el 14 de septiembre" is arithmetic to do first.
 * Further out it stays a plain date, or every row would cry wolf.
 */
function expiryNotice(
  product: Pick<ProductRowProps["product"], "status" | "expires_at">,
): { text: string; isUrgent: boolean } | null {
  if (!product.expires_at) return null;
  if (product.status === "draft") return null;

  const msLeft = new Date(product.expires_at).getTime() - Date.now();
  if (msLeft <= 0) return { text: `Venció el ${formatDate(product.expires_at)}`, isUrgent: false };
  if (product.status !== "published") return null;

  const daysLeft = Math.round(msLeft / DAY_MS);
  if (daysLeft > EXPIRY_WARNING_DAYS) {
    return { text: `Vence el ${formatDate(product.expires_at)}`, isUrgent: false };
  }
  if (daysLeft <= 0) return { text: "Vence hoy", isUrgent: true };
  if (daysLeft === 1) return { text: "Vence mañana", isUrgent: true };
  return { text: `Vence en ${daysLeft} días`, isUrgent: true };
}

export function ProductRow({ product }: ProductRowProps) {
  const publicationState = getSellerPublicationState(product);
  const deleteAction = deleteProduct.bind(null, product.id);
  // Read from the state the badge reports, not from the status column. For up
  // to an hour after a listing lapses the column still says published while
  // the badge already says "Vencido", and offering "Despublicar" there asks
  // the seller to switch off something that has already stopped selling.
  const hasLapsed = publicationState.kind === "expired";
  const nextStatus = product.status === "published" && !hasLapsed ? "draft" : "published";
  const toggleLabel = hasLapsed
    ? "Reactivar"
    : product.status === "published"
      ? "Despublicar"
      : "Publicar";
  const expiry = expiryNotice(product);

  return (
    <li className="py-4"><div className="flex items-start gap-3"><div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-background text-brand/35">{product.image_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt="" className="size-full object-cover" src={product.image_url} />
    ) : <ImageIcon aria-hidden="true" className="size-5" />}</div>{/* The badge sits beside the name only where there is room for both. On a
        phone it drops below, because the name is what the seller scans for and
        a pill next to it cut the name down to about two words. */}<div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3"><div className="min-w-0"><p className="truncate font-semibold">{product.name}</p><p className="mt-1 text-sm text-muted">{formatMxn(product.price_mxn)}</p>{expiry ? <p className={`mt-1 text-xs ${expiry.isUrgent ? "font-semibold text-sale" : "text-muted"}`}>{expiry.text}</p> : null}</div><span className={`inline-flex w-fit shrink-0 rounded-full px-3 py-1 text-xs font-bold ${publicationState.isPublic ? "bg-accent text-brand-hover" : "bg-background text-muted"}`}>{publicationState.label}</span></div></div><div className="mt-3 flex flex-wrap items-center gap-3 pl-[4.25rem]"><Link className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-brand" href={`/panel/productos/${product.id}/editar`}><Edit3 aria-hidden="true" className="size-3.5" />Editar</Link><ProductStatusAction label={toggleLabel} nextStatus={nextStatus} productId={product.id} /><details><summary className="inline-flex min-h-11 cursor-pointer items-center gap-1 text-xs font-semibold text-sale"><Trash2 aria-hidden="true" className="size-3.5" />Eliminar</summary><form action={deleteAction} className="mt-2 rounded-xl bg-sale/10 p-3"><p className="mb-2 text-xs text-ink">Esta acción no se puede deshacer.</p><button className="inline-flex min-h-11 items-center rounded-full bg-sale px-3 py-1.5 text-xs font-semibold text-white" type="submit">Confirmar</button></form></details></div></li>
  );
}
