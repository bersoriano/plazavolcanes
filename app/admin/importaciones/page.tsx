import Link from "next/link";
import { Import } from "lucide-react";

import { pageContainer } from "@/components/layout/container";
import { EmptyState } from "@/components/ui/empty-state";
import { completeImportRequest } from "@/lib/actions/listing-import";
import { formatDate } from "@/lib/format";
import { getAdminImportRequests } from "@/lib/queries/listing-import.server";

/**
 * The import-help queue: links sellers sent from Mercado Libre or Facebook,
 * oldest first. Someone creates the drafts in the shop by hand, then marks
 * the request done so the seller sees it.
 */
export default async function AdminImportsPage() {
  const requests = await getAdminImportRequests();

  return (
    <section className={`${pageContainer} py-10 sm:py-14`}>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Administración</p>
      <h1 className="mt-2 font-display text-4xl font-semibold">Importaciones</h1>
      {requests.length ? (
        <div className="mt-8 space-y-6">
          {requests.map((request) => (
            <article className="rounded-[2rem] border border-line bg-surface p-6 sm:p-8" key={request.id}>
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <p className={`text-sm font-semibold ${request.status === "done" ? "text-success" : "text-brand"}`}>
                    {request.status === "done" ? "Lista" : "En espera"} · {formatDate(request.created_at)}
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-semibold">
                    <Link className="hover:underline" href={`/tiendas/${request.shop_slug}`}>
                      {request.shop_name}
                    </Link>
                  </h2>
                </div>
                {request.status === "pending" ? (
                  <form action={completeImportRequest.bind(null, request.id)}>
                    <button className="min-h-11 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white" type="submit">
                      Marcar como lista
                    </button>
                  </form>
                ) : null}
              </div>
              {request.note ? <p className="mt-4 leading-7 text-muted">{request.note}</p> : null}
              <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm">
                {request.links.map((link) => (
                  <li className="break-all" key={link}>
                    <a className="text-brand underline" href={link} rel="noopener noreferrer nofollow" target="_blank">
                      {link}
                    </a>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState
            description="Los enlaces que envíen las tiendas para traer sus productos aparecerán aquí."
            icon={<Import aria-hidden="true" className="size-7" />}
            title="No hay solicitudes"
          />
        </div>
      )}
    </section>
  );
}
