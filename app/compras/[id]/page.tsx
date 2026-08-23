import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { formatCurrency, formatDate } from "@/lib/format";
import { formatOrderStatus } from "@/lib/order-status";
import { getOrderDetail } from "@/lib/queries/orders.server";
import { Conversation } from "@/components/orders/conversation";
import { OrderActions } from "@/components/orders/order-actions";
import { sendMessage } from "@/lib/actions/messages";
import { cancelOrderAsBuyer, transitionOrder } from "@/lib/actions/orders";
import { DisputeForm } from "@/components/orders/dispute-form";
import { ReviewForm } from "@/components/orders/review-form";
import { createReview, openDispute } from "@/lib/actions/trust-evidence";

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isSafeInteger(orderId) || orderId < 1) notFound();
  const order = await getOrderDetail(orderId);
  if (!order) notFound();
  const receiveAction = transitionOrder.bind(null, order.id, "receive");
  const completeAction = transitionOrder.bind(null, order.id, "complete");
  const cancelBuyerAction = cancelOrderAsBuyer.bind(null, order.id);
  const messageAction = order.conversation ? sendMessage.bind(null, order.conversation.id, [
        `/compras/${order.id}`,
        `/panel/pedidos/${order.id}`,
        "/mensajes",
        "/panel/mensajes",
      ]) : null;
  const reviewAction = createReview.bind(null, order.id);
  const disputeAction = openDispute.bind(null, order.id);
  const canDispute = ["shipped", "delivered", "completed"].includes(order.status);
  return <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-brand" href="/compras"><ArrowLeft aria-hidden="true" className="size-4" />Mis compras</Link><div className="mt-7 grid gap-7 lg:grid-cols-[1fr_360px]"><div className="rounded-[2rem] border border-line bg-surface p-6 sm:p-8"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Pedido #{order.id}</p><h1 className="mt-2 font-display text-3xl font-semibold">{order.shop.name}</h1><p className="mt-2 text-muted">Estado: <strong className="text-ink">{formatOrderStatus(order.status)}</strong></p><div className="mt-5"><OrderActions actions={{ receive: receiveAction, complete: completeAction, cancelBuyer: cancelBuyerAction }} paymentCompletedAt={order.payment_completed_at} paymentConfirmationRequired={order.payment_confirmation_required} role="buyer" status={order.status} /></div><h2 className="mt-8 font-display text-2xl font-semibold">Productos</h2><ul className="mt-4 divide-y divide-line">{order.items.map((item) => <li className="flex justify-between gap-4 py-4" key={item.id}><span>{item.quantity} × {item.product_name}</span><strong>{formatCurrency(item.line_total, order.currency_code)}</strong></li>)}</ul><div className="flex justify-between border-t border-line pt-4 text-lg font-semibold"><span>Subtotal</span><span>{formatCurrency(order.subtotal, order.currency_code)}</span></div>{order.tracking_text ? <p className="mt-4 rounded-xl bg-background p-4 text-sm"><strong>Seguimiento:</strong> {order.tracking_text}</p> : null}</div><aside className="space-y-5"><div className="rounded-[2rem] border border-line bg-surface p-6"><h2 className="font-display text-xl font-semibold">Entrega</h2>{order.address?.redacted_at ? <p className="mt-3 text-sm text-muted">Dirección eliminada según política de retención.</p> : <address className="mt-3 not-italic leading-7 text-muted">{order.address?.recipient}<br />{order.address?.address_line1}{order.address?.address_line2 ? `, ${order.address.address_line2}` : ""}<br />{order.address?.locality}, {order.address?.administrative_area} {order.address?.postal_code}<br />{order.address?.country_code}</address>}</div><div className="rounded-[2rem] border border-line bg-surface p-6"><h2 className="font-display text-xl font-semibold">Historial</h2><ol className="mt-4 space-y-4">{order.events.map((event) => <li className="border-l-2 border-accent pl-4" key={event.id}><p className="font-semibold">{event.event_type}</p><p className="text-sm text-muted">{formatDate(event.created_at)}</p></li>)}</ol></div></aside></div>{order.conversation && messageAction ? <div className="mt-7"><Conversation action={messageAction} currentUserId={order.current_user_id} messages={order.conversation.messages} /></div> : null}<div className="mt-7 grid gap-7 md:grid-cols-2">{order.status === "completed" && !order.review ? <ReviewForm action={reviewAction} /> : order.review ? <div className="rounded-[2rem] border border-line bg-surface p-6"><h2 className="font-display text-2xl font-semibold">Tu reseña</h2><p className="mt-3 font-semibold">{order.review.rating} de 5 estrellas</p><p className="mt-2 text-muted">{order.review.matched_description ? "Coincidió con descripción" : "No coincidió con descripción"}</p></div> : null}{canDispute && !order.dispute ? <DisputeForm action={disputeAction} /> : order.dispute ? <div className="rounded-[2rem] border border-sale/30 bg-sale/5 p-6"><h2 className="font-display text-xl font-semibold text-sale">Disputa {order.dispute.status}</h2><p className="mt-3 leading-7">{order.dispute.buyer_statement}</p>{order.dispute.resolution_notes ? <p className="mt-3 text-sm text-muted">Resolución: {order.dispute.resolution_notes}</p> : null}</div> : null}</div></section>;
}
