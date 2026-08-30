import Link from "next/link";
import { Edit3, ImageIcon, Trash2 } from "lucide-react";

import { ProductStatusAction } from "@/components/products/product-status-action";
import type { ListingStatus } from "@/components/ui/status-badge";
import { deleteProduct } from "@/lib/actions/products";
import { formatDate, formatMxn } from "@/lib/format";
import { getCatalogImageUrl } from "@/lib/storage";

type ProductRowProps = {
  product: {
    id: number;
    name: string;
    price_mxn: number;
    image_path: string | null;
    status: ListingStatus;
    expires_at: string | null;
    is_admin_enabled: boolean;
    is_publishing_approved: boolean;
    publishing_reviewed_at: string | null;
  };
};

export type SellerPublicationState = {
  label: string;
  isPublic: boolean;
};

export function getSellerPublicationState(
  product: Pick<ProductRowProps["product"], "status" | "expires_at" | "is_admin_enabled" | "is_publishing_approved" | "publishing_reviewed_at">,
): SellerPublicationState {
  if (product.status === "draft") return { label: "Desactivado por ti", isPublic: false };
  if (product.status === "expired") return { label: "Vencido", isPublic: false };
  if (!product.is_publishing_approved) {
    return product.publishing_reviewed_at
      ? { label: "Tienda deshabilitada por administración", isPublic: false }
      : { label: "Esperando aprobación de administración", isPublic: false };
  }
  if (!product.is_admin_enabled) return { label: "Deshabilitado por administración", isPublic: false };
  if (!product.expires_at || new Date(product.expires_at).getTime() <= Date.now()) return { label: "Vencido", isPublic: false };
  return { label: "Publicado", isPublic: true };
}

export function ProductRow({ product }: ProductRowProps) {
  const imageUrl = getCatalogImageUrl(product.image_path);
  const publicationState = getSellerPublicationState(product);
  const nextStatus = product.status === "published" ? "draft" : "published";
  const deleteAction = deleteProduct.bind(null, product.id);
  const toggleLabel = product.status === "published"
    ? "Despublicar"
    : product.status === "expired"
      ? "Reactivar"
      : "Publicar";
  const expiry = product.expires_at
    ? product.status === "published"
      ? `Vence el ${formatDate(product.expires_at)}`
      : product.status === "expired"
        ? `Venció el ${formatDate(product.expires_at)}`
        : null
    : null;

  return (
    <li className="py-4"><div className="flex items-center gap-3"><div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-background text-brand/35">{imageUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt="" className="size-full object-cover" src={imageUrl} />
    ) : <ImageIcon aria-hidden="true" className="size-5" />}</div><div className="min-w-0 flex-1"><p className="truncate font-semibold">{product.name}</p><p className="mt-1 text-sm text-muted">{formatMxn(product.price_mxn)}</p>{expiry ? <p className="mt-1 text-xs text-muted">{expiry}</p> : null}</div><span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${publicationState.isPublic ? "bg-accent text-brand-hover" : "bg-background text-muted"}`}>{publicationState.label}</span></div><div className="mt-3 flex flex-wrap items-center gap-3 pl-[4.25rem]"><Link className="inline-flex items-center gap-1 text-xs font-semibold text-brand" href={`/panel/productos/${product.id}/editar`}><Edit3 aria-hidden="true" className="size-3.5" />Editar</Link><ProductStatusAction label={toggleLabel} nextStatus={nextStatus} productId={product.id} /><details><summary className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-sale"><Trash2 aria-hidden="true" className="size-3.5" />Eliminar</summary><form action={deleteAction} className="mt-2 rounded-xl bg-sale/10 p-3"><p className="mb-2 text-xs text-ink">Esta acción no se puede deshacer.</p><button className="rounded-full bg-sale px-3 py-1.5 text-xs font-semibold text-white" type="submit">Confirmar</button></form></details></div></li>
  );
}
