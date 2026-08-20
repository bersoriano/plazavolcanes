import { Scale } from "lucide-react";

import { DisputeResolutionForm } from "@/components/orders/dispute-resolution-form";
import { EmptyState } from "@/components/ui/empty-state";
import { resolveDispute } from "@/lib/actions/trust-evidence";
import { formatDate } from "@/lib/format";
import { getAdminDisputes } from "@/lib/queries/admin.server";

export default async function AdminDisputesPage() {
  const disputes = await getAdminDisputes();
  return <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Administración</p><h1 className="mt-2 font-display text-4xl font-semibold">Disputas</h1>{disputes.length ? <div className="mt-8 space-y-6">{disputes.map((dispute) => <article className="rounded-[2rem] border border-line bg-surface p-6 sm:p-8" key={dispute.id}><div className="flex flex-wrap justify-between gap-4"><div><p className="text-sm font-semibold text-brand">Pedido #{dispute.order_id}</p><h2 className="mt-1 font-display text-2xl font-semibold">{dispute.shop.name}</h2></div><p className="text-sm text-muted">{formatDate(dispute.opened_at)}</p></div><div className="mt-5 rounded-2xl bg-background p-5"><p className="text-sm font-semibold">Comprador</p><p className="mt-2 leading-7 text-muted">{dispute.buyer_statement}</p>{dispute.seller_response ? <><p className="mt-5 text-sm font-semibold">Vendedor</p><p className="mt-2 leading-7 text-muted">{dispute.seller_response}</p></> : null}</div><DisputeResolutionForm action={resolveDispute.bind(null, dispute.id)} /></article>)}</div> : <div className="mt-8"><EmptyState icon={<Scale aria-hidden="true" className="size-7" />} title="No hay disputas abiertas" description="Las solicitudes pendientes de resolución aparecerán aquí." /></div>}</section>;
}
