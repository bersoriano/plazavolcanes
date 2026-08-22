import Link from "next/link";
import { Edit3, ImageIcon, Trash2 } from "lucide-react";

import { StatusBadge, type ListingStatus } from "@/components/ui/status-badge";
import { deleteProduct, setProductStatus } from "@/lib/actions/products";
import { formatDate, formatMxn } from "@/lib/format";
import { getCatalogImageUrl } from "@/lib/storage";

type ProductRowProps = {
  product: { id: number; name: string; price_mxn: number; image_path: string | null; status: ListingStatus; expires_at: string | null };
};

export function ProductRow({ product }: ProductRowProps) {
  const imageUrl = getCatalogImageUrl(product.image_path);
  const toggleAction = setProductStatus.bind(null, product.id, product.status === "published" ? "draft" : "published");
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
    ) : <ImageIcon aria-hidden="true" className="size-5" />}</div><div className="min-w-0 flex-1"><p className="truncate font-semibold">{product.name}</p><p className="mt-1 text-sm text-muted">{formatMxn(product.price_mxn)}</p>{expiry ? <p className="mt-1 text-xs text-muted">{expiry}</p> : null}</div><StatusBadge status={product.status} /></div><div className="mt-3 flex flex-wrap items-center gap-3 pl-[4.25rem]"><Link className="inline-flex items-center gap-1 text-xs font-semibold text-brand" href={`/panel/productos/${product.id}/editar`}><Edit3 aria-hidden="true" className="size-3.5" />Editar</Link><form action={toggleAction}><button className="text-xs font-semibold text-brand" type="submit">{toggleLabel}</button></form><details><summary className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-sale"><Trash2 aria-hidden="true" className="size-3.5" />Eliminar</summary><form action={deleteAction} className="mt-2 rounded-xl bg-sale/10 p-3"><p className="mb-2 text-xs text-ink">Esta acción no se puede deshacer.</p><button className="rounded-full bg-sale px-3 py-1.5 text-xs font-semibold text-white" type="submit">Confirmar</button></form></details></div></li>
  );
}
