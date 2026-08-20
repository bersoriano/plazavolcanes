import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { formatCurrency, formatDate } from "@/lib/format";
import { getOrderDetail } from "@/lib/queries/orders.server";

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isSafeInteger(orderId) || orderId < 1) notFound();
  const order = await getOrderDetail(orderId);
  if (!order) notFound();
  return <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-brand" href="/compras"><ArrowLeft aria-hidden="true" className="size-4" />Mis compras</Link><div className="mt-7 grid gap-7 lg:grid-cols-[1fr_360px]"><div className="rounded-[2rem] border border-line bg-surface p-6 sm:p-8"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Pedido #{order.id}</p><h1 className="mt-2 font-display text-3xl font-semibold">{order.shop.name}</h1><p className="mt-2 text-muted">Estado: <strong className="text-ink">{order.status}</strong></p><h2 className="mt-8 font-display text-2xl font-semibold">Productos</h2><ul className="mt-4 divide-y divide-line">{order.items.map((item) => <li className="flex justify-between gap-4 py-4" key={item.id}><span>{item.quantity} × {item.product_name}</span><strong>{formatCurrency(item.line_total, order.currency_code)}</strong></li>)}</ul><div className="flex justify-between border-t border-line pt-4 text-lg font-semibold"><span>Subtotal</span><span>{formatCurrency(order.subtotal, order.currency_code)}</span></div></div><aside className="space-y-5"><div className="rounded-[2rem] border border-line bg-surface p-6"><h2 className="font-display text-xl font-semibold">Entrega</h2>{order.address?.redacted_at ? <p className="mt-3 text-sm text-muted">Dirección eliminada según política de retención.</p> : <address className="mt-3 not-italic leading-7 text-muted">{order.address?.recipient}<br />{order.address?.address_line1}{order.address?.address_line2 ? `, ${order.address.address_line2}` : ""}<br />{order.address?.locality}, {order.address?.administrative_area} {order.address?.postal_code}<br />{order.address?.country_code}</address>}</div><div className="rounded-[2rem] border border-line bg-surface p-6"><h2 className="font-display text-xl font-semibold">Historial</h2><ol className="mt-4 space-y-4">{order.events.map((event) => <li className="border-l-2 border-accent pl-4" key={event.id}><p className="font-semibold">{event.event_type}</p><p className="text-sm text-muted">{formatDate(event.created_at)}</p></li>)}</ol></div></aside></div></section>;
}
