import Link from "next/link";
import { ShoppingBag } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/format";
import { getBuyerOrders } from "@/lib/queries/orders.server";

const status: Record<string, string> = { requested: "Solicitud enviada", accepted: "Aceptado", shipped: "Enviado", delivered: "Recibido", completed: "Completado", rejected: "Rechazado", canceled_by_buyer: "Cancelado", canceled_by_seller: "Cancelado por vendedor", canceled_by_admin: "Cancelado por administración" };

export default async function PurchasesPage() {
  const orders = await getBuyerOrders();
  return <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Tus solicitudes</p><h1 className="mt-2 font-display text-4xl font-semibold">Mis compras</h1>{orders.length ? <ul className="mt-8 space-y-4">{orders.map((order) => <li key={order.id}><Link className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-brand" href={`/compras/${order.id}`}><div><p className="text-sm font-semibold text-brand">Pedido #{order.id}</p><h2 className="mt-1 text-lg font-semibold">{order.shop.name}</h2><p className="mt-1 text-sm text-muted">{formatDate(order.created_at)}</p></div><div className="text-right"><span className="rounded-full bg-accent/45 px-3 py-1 text-sm font-semibold text-brand-hover">{status[order.status] ?? order.status}</span><p className="mt-3 font-semibold">{formatCurrency(order.subtotal, order.currency_code)}</p></div></Link></li>)}</ul> : <div className="mt-8"><EmptyState icon={<ShoppingBag aria-hidden="true" className="size-7" />} title="Todavía no tienes pedidos" description="Solicita productos de tiendas independientes y sigue su avance aquí." /></div>}</section>;
}
