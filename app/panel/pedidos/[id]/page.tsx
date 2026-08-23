import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { formatCurrency } from "@/lib/format";
import { formatOrderStatus } from "@/lib/order-status";
import { getOrderDetail } from "@/lib/queries/orders.server";
import { Conversation } from "@/components/orders/conversation";
import { OrderActions } from "@/components/orders/order-actions";
import { BuyerTrustCard } from "@/components/orders/buyer-trust-card";
import { sendMessage } from "@/lib/actions/messages";
import { cancelOrderAsSeller, confirmOrderPayment, transitionOrder } from "@/lib/actions/orders";
import { DisputeResponseForm } from "@/components/orders/dispute-response-form";
import { respondToDispute } from "@/lib/actions/trust-evidence";
import { getBuyerTrustForOrder } from "@/lib/queries/buyer-trust.server";

export default async function SellerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isSafeInteger(orderId) || orderId < 1) notFound();
  const [order, buyerTrust] = await Promise.all([getOrderDetail(orderId), getBuyerTrustForOrder(orderId)]);
  if (!order || order.viewer_role !== "seller") notFound();
  const acceptAction = transitionOrder.bind(null, order.id, "accept");
  const rejectAction = transitionOrder.bind(null, order.id, "reject");
  const shipAction = transitionOrder.bind(null, order.id, "ship");
  const paymentAction = confirmOrderPayment.bind(null, order.id);
  const cancelSellerAction = cancelOrderAsSeller.bind(null, order.id);
  const messageAction = order.conversation ? sendMessage.bind(null, order.conversation.id, [
        `/compras/${order.id}`,
        `/panel/pedidos/${order.id}`,
        "/mensajes",
        "/panel/mensajes",
      ]) : null;
  const disputeResponseAction = order.dispute ? respondToDispute.bind(null, order.dispute.id, order.id) : null;
  return <section className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-brand" href="/panel/pedidos"><ArrowLeft aria-hidden="true" className="size-4" />Pedidos</Link>{buyerTrust ? <div className="mt-7"><BuyerTrustCard trust={buyerTrust} /></div> : null}<div className="mt-7 rounded-[2rem] border border-line bg-surface p-6 sm:p-8"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Pedido #{order.id}</p><h1 className="mt-2 font-display text-3xl font-semibold">{order.shop.name}</h1><p className="mt-2 text-muted">Estado: {formatOrderStatus(order.status)}</p><p className="mt-2 text-sm text-muted">Preparación prometida: {order.handling_days} días hábiles{order.ship_by_at ? ` · enviar antes de ${order.ship_by_at}` : ""}</p>{order.payment_confirmation_required ? <p className="mt-2 text-sm font-semibold text-brand">Pago: {order.payment_completed_at ? "confirmado" : "pendiente de confirmación"}</p> : null}<div className="mt-5"><OrderActions actions={{ accept: acceptAction, reject: rejectAction, ship: shipAction, payment: paymentAction, cancelSeller: cancelSellerAction }} paymentCompletedAt={order.payment_completed_at} paymentConfirmationRequired={order.payment_confirmation_required} role="seller" status={order.status} /></div><ul className="mt-7 divide-y divide-line">{order.items.map((item) => <li className="flex justify-between gap-4 py-4" key={item.id}><span>{item.quantity} × {item.product_name}</span><strong>{formatCurrency(item.line_total, order.currency_code)}</strong></li>)}</ul><div className="mt-4 rounded-2xl bg-background p-5"><h2 className="font-semibold">Dirección de entrega</h2><address className="mt-2 not-italic leading-7 text-muted">{order.address?.recipient}<br />{order.address?.address_line1}{order.address?.address_line2 ? `, ${order.address.address_line2}` : ""}<br />{order.address?.locality}, {order.address?.administrative_area} {order.address?.postal_code}</address></div></div>{order.conversation && messageAction ? <div className="mt-7"><Conversation action={messageAction} currentUserId={order.current_user_id} messages={order.conversation.messages} /></div> : null}{order.dispute ? <section className="mt-7 rounded-[2rem] border border-sale/30 bg-sale/5 p-6"><h2 className="font-display text-2xl font-semibold text-sale">Disputa</h2><p className="mt-3 leading-7">{order.dispute.buyer_statement}</p>{order.dispute.seller_response ? <p className="mt-4 rounded-2xl bg-surface p-4 text-muted">Tu respuesta: {order.dispute.seller_response}</p> : disputeResponseAction && order.dispute.status !== "resolved" ? <DisputeResponseForm action={disputeResponseAction} /> : null}</section> : null}</section>;
}
