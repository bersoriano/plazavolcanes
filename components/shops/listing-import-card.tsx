import { Import } from "lucide-react";

import { ListingImportForm } from "@/components/shops/listing-import-form";
import type { ActionState } from "@/lib/action-state";
import { formatDate } from "@/lib/format";
import type { ShopImportRequest } from "@/lib/queries/listing-import.server";

/**
 * Import help: a seller pastes the links to what they already sell on
 * Mercado Libre or Facebook, and the team turns them into drafts here by
 * hand. Folded, since a seller uses it once or twice.
 */
export function ListingImportCard({
  action,
  requests,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  requests: ShopImportRequest[];
}) {
  return (
    <details className="group rounded-[2rem] border border-line bg-surface px-6 py-5 sm:px-8">
      <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
        <Import aria-hidden="true" className="size-4 text-brand" />
        <span className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Trae tus productos</span>
      </summary>
      <p className="mt-3 text-sm leading-6 text-muted">
        ¿Ya vendes en Mercado Libre o Facebook? Pega los enlaces de tus publicaciones y el equipo de Plaza Volcanes
        las pasa a tu tienda como borradores, con título, descripción y fotos. Tú revisas cada una y la publicas.
      </p>

      {requests.length ? (
        <ul className="mt-4 divide-y divide-line text-sm" aria-label="Tus solicitudes">
          {requests.map((request) => (
            <li className="flex flex-wrap justify-between gap-2 py-2" key={request.id}>
              <span>
                {request.link_count} {request.link_count === 1 ? "enlace" : "enlaces"} · {formatDate(request.created_at)}
              </span>
              <span className={request.status === "done" ? "font-semibold text-success" : "text-muted"}>
                {request.status === "done" ? "Borradores listos" : "En espera"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <ListingImportForm action={action} />
    </details>
  );
}
