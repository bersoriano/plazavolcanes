import type { Database } from "@/lib/database.types";

type DisputeStatus = Database["public"]["Tables"]["order_disputes"]["Row"]["status"];

/**
 * The order timeline, in the buyer's words.
 *
 * `order_events.event_type` is a check constraint in the database and a plain
 * `string` in the generated types, so nothing here can be proven exhaustive by
 * the compiler. The list mirrors the constraint and `lib/order-events.test.ts`
 * holds the two together; the fallback exists because a later migration can
 * widen the constraint without touching this file, and a buyer should read
 * "Actualización del pedido" rather than `admin_repair`.
 */
export const ORDER_EVENT_TYPES = [
  "requested",
  "accepted",
  "rejected",
  "payment_confirmed",
  "shipped",
  "delivered",
  "completed",
  "auto_completed",
  "canceled_by_buyer",
  "canceled_by_seller",
  "canceled_by_admin",
  "admin_delivery_confirmed",
  "admin_repair",
] as const;

export type OrderEventType = (typeof ORDER_EVENT_TYPES)[number];

const eventLabels: Record<OrderEventType, string> = {
  requested: "Solicitud enviada",
  accepted: "Aceptada por la tienda",
  rejected: "Rechazada por la tienda",
  payment_confirmed: "Pago confirmado",
  shipped: "Enviado",
  delivered: "Recibido",
  completed: "Compra completada",
  auto_completed: "Completada automáticamente",
  // Neutral about who cancelled: the seller's order page reads these too, so
  // "por ti" would be wrong on one side of the same event.
  canceled_by_buyer: "Cancelada por el comprador",
  canceled_by_seller: "Cancelada por la tienda",
  canceled_by_admin: "Cancelada por administración",
  admin_delivery_confirmed: "Entrega confirmada por administración",
  admin_repair: "Corrección de administración",
};

export function formatOrderEvent(eventType: string): string {
  return eventLabels[eventType as OrderEventType] ?? "Actualización del pedido";
}

const disputeLabels: Record<DisputeStatus, string> = {
  open: "abierta",
  seller_responded: "con respuesta de la tienda",
  resolved: "resuelta",
};

/** A lowercase fragment: both order pages render it after the word "Disputa". */
export function formatDisputeStatus(status: DisputeStatus): string {
  return disputeLabels[status];
}
