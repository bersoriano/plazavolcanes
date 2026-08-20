import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { formatCurrency } from "@/lib/format";
import { getOrderDetail } from "@/lib/queries/orders.server";

export default async function SellerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isSafeInteger(orderId) || orderId < 1) notFound();
  const order = await getOrderDetail(orderId);
  if (!order) notFound();
  return <section className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-brand" href="/panel/pedidos"><ArrowLeft aria-hidden="true" className="size-4" />Pedidos</Link><div className="mt-7 rounded-[2rem] border border-line bg-surface p-6 sm:p-8"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Pedido #{order.id}</p><h1 className="mt-2 font-display text-3xl font-semibold">{order.shop.name}</h1><p className="mt-2 text-muted">Estado: {order.status}</p><ul className="mt-7 divide-y divide-line">{order.items.map((item) => <li className="flex justify-between gap-4 py-4" key={item.id}><span>{item.quantity} × {item.product_name}</span><strong>{formatCurrency(item.line_total, order.currency_code)}</strong></li>)}</ul><div className="mt-4 rounded-2xl bg-background p-5"><h2 className="font-semibold">Dirección de entrega</h2><address className="mt-2 not-italic leading-7 text-muted">{order.address?.recipient}<br />{order.address?.address_line1}{order.address?.address_line2 ? `, ${order.address.address_line2}` : ""}<br />{order.address?.locality}, {order.address?.administrative_area} {order.address?.postal_code}</address></div></div></section>;
}
