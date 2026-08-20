import Link from "next/link";
import { PackageOpen } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatOrderStatus } from "@/lib/order-status";
import { getSellerOrders } from "@/lib/queries/orders.server";

export default async function SellerOrdersPage() {
  const orders = await getSellerOrders();
  return <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Ventas</p><h1 className="mt-2 font-display text-4xl font-semibold">Pedidos</h1>{orders.length ? <ul className="mt-8 space-y-4">{orders.map((order) => <li key={order.id}><Link className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5 hover:border-brand" href={`/panel/pedidos/${order.id}`}><div><p className="text-sm font-semibold text-brand">Pedido #{order.id}</p><h2 className="mt-1 text-lg font-semibold">{order.shop.name}</h2><p className="text-sm text-muted">{formatDate(order.created_at)}</p></div><div className="text-right"><p className="font-semibold">{formatCurrency(order.subtotal, order.currency_code)}</p><p className="mt-1 text-sm text-muted">{formatOrderStatus(order.status)}</p></div></Link></li>)}</ul> : <div className="mt-8"><EmptyState icon={<PackageOpen aria-hidden="true" className="size-7" />} title="Aún no recibes pedidos" description="Las solicitudes de compradores aparecerán aquí." /></div>}</section>;
}
