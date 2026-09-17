import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { formatCurrency } from "@/lib/format";
import { formatOrderStatus } from "@/lib/order-status";
import { getOrderDetail } from "@/lib/queries/orders.server";
import { MessageThread } from "@/components/messages/message-thread";
import { OrderActions } from "@/components/orders/order-actions";
import { BuyerTrustCard } from "@/components/orders/buyer-trust-card";
import { FulfillmentSummary } from "@/components/orders/fulfillment-summary";
import { sendMessage } from "@/lib/actions/messages";
import { cancelOrderAsSeller, confirmOrderPayment, transitionOrder } from "@/lib/actions/orders";
import { DisputeResponseForm } from "@/components/orders/dispute-response-form";
import { respondToDispute } from "@/lib/actions/trust-evidence";
import { getBuyerTrustForOrder } from "@/lib/queries/buyer-trust.server";
import { fetchPickupPoint } from "@/lib/queries/checkout.server";
import { sellerOrderGuidance, URGENCY_LABELS } from "@/lib/seller-action-queue";

const URGENCY_STYLES = {
  overdue: "bg-sale/15 text-sale",
  due_soon: "bg-accent text-brand",
  none: "",
} as const;

export default async function SellerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isSafeInteger(orderId) || orderId < 1) notFound();
  const [order, buyerTrust] = await Promise.all([getOrderDetail(orderId), getBuyerTrustForOrder(orderId)]);
  if (!order || order.viewer_role !== "seller") notFound();
  const pickupPoint = order.fulfillment_method === "pickup"
    ? await fetchPickupPoint(order.shop.id)
    : null;
  const guidance = sellerOrderGuidance(order, new Date());
  const acceptAction = transitionOrder.bind(null, order.id, "accept");
  const rejectAction = transitionOrder.bind(null, order.id, "reject");
  const shipAction = transitionOrder.bind(null, order.id, "ship");
  const paymentAction = confirmOrderPayment.bind(null, order.id);
  const cancelSellerAction = cancelOrderAsSeller.bind(null, order.id);
  // A reply here also takes the thread off the seller's action queue.
  const messageAction = order.conversation ? sendMessage.bind(null, order.conversation.id, [
        `/compras/${order.id}`,
        `/panel/pedidos/${order.id}`,
        `/mensajes/${order.conversation.id}`,
        "/mensajes",
        "/panel",
      ]) : null;
  const disputeResponseAction = order.dispute ? respondToDispute.bind(null, order.dispute.id, order.id) : null;
  const urgencyLabel = guidance.deadline ? URGENCY_LABELS[guidance.deadline.urgency] : null;

  return (
    <section className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand" href="/panel/pedidos">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Pedidos
      </Link>

      <section aria-labelledby="order-next-step" className="mt-7 rounded-[2rem] border border-brand/30 bg-surface p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Pedido #{order.id} · Siguiente paso</p>
        <h1 className="mt-2 font-display text-3xl font-semibold" id="order-next-step">{guidance.title}</h1>
        <p className="mt-3 max-w-2xl leading-7 text-muted">{guidance.detail}</p>
        {guidance.deadline ? (
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {urgencyLabel ? (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${URGENCY_STYLES[guidance.deadline.urgency]}`}>{urgencyLabel}</span>
            ) : null}
            <time className={guidance.deadline.urgency === "overdue" ? "font-semibold text-sale" : "font-semibold text-ink"} dateTime={guidance.deadline.dateTime}>
              {guidance.deadline.label}
            </time>
          </p>
        ) : null}
        <div className="mt-5">
          <OrderActions
            actions={{ accept: acceptAction, reject: rejectAction, ship: shipAction, payment: paymentAction, cancelSeller: cancelSellerAction }}
            fulfillmentMethod={order.fulfillment_method}
            paymentCompletedAt={order.payment_completed_at}
            paymentConfirmationRequired={order.payment_confirmation_required}
            role="seller"
            status={order.status}
          />
        </div>
        <p className="mt-5 text-xs leading-5 text-muted">
          Aún no enviamos avisos por correo ni notificaciones: el comprador ve cada cambio al abrir su compra. Si necesitas avisarle algo, escríbele en la conversación.
        </p>
      </section>

      {buyerTrust ? <div className="mt-7"><BuyerTrustCard trust={buyerTrust} /></div> : null}

      <div className="mt-7 rounded-[2rem] border border-line bg-surface p-6 sm:p-8">
        <h2 className="font-display text-2xl font-semibold">{order.shop.name}</h2>
        <p className="mt-2 text-muted">Estado: {formatOrderStatus(order.status, order.fulfillment_method)}</p>
        <p className="mt-2 text-sm text-muted">Preparación prometida: {order.handling_days} días hábiles</p>
        {order.payment_confirmation_required ? (
          <p className="mt-2 text-sm font-semibold text-brand">Pago: {order.payment_completed_at ? "confirmado" : "pendiente de confirmación"}</p>
        ) : null}
        {order.tracking_text ? <p className="mt-2 text-sm text-muted">Seguimiento: {order.tracking_text}</p> : null}
        <ul className="mt-7 divide-y divide-line">
          {order.items.map((item) => (
            <li className="flex justify-between gap-4 py-4" key={item.id}>
              <span>{item.quantity} × {item.product_name}</span>
              <strong>{formatCurrency(item.line_total, order.currency_code)}</strong>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <FulfillmentSummary altContact={order.alt_contact} address={order.address} fulfillmentMethod={order.fulfillment_method} pickupPoint={pickupPoint} />
        </div>
      </div>

      {order.conversation && messageAction ? (
        <div className="mt-7">
          <MessageThread action={messageAction} conversationId={order.conversation.id} currentUserId={order.current_user_id} messages={order.conversation.messages} />
        </div>
      ) : null}

      {order.dispute ? (
        <section className="mt-7 rounded-[2rem] border border-sale/30 bg-sale/5 p-6">
          <h2 className="font-display text-2xl font-semibold text-sale">Disputa</h2>
          <p className="mt-3 leading-7">{order.dispute.buyer_statement}</p>
          {order.dispute.seller_response ? (
            <p className="mt-4 rounded-2xl bg-surface p-4 text-muted">Tu respuesta: {order.dispute.seller_response}</p>
          ) : disputeResponseAction && order.dispute.status !== "resolved" ? (
            <DisputeResponseForm action={disputeResponseAction} />
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
