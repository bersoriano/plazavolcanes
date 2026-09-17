import type { OrderStatus } from "@/lib/database.types";

const labels: Record<OrderStatus, string> = {
  requested: "Solicitud enviada",
  accepted: "Aceptado",
  shipped: "Enviado",
  delivered: "Recibido",
  completed: "Completado",
  rejected: "Rechazado",
  canceled_by_buyer: "Cancelado por comprador",
  canceled_by_seller: "Cancelado por vendedor",
  canceled_by_admin: "Cancelado por administración",
};

/**
 * A collected order goes through "shipped" when the seller hands it over, so
 * for pickup that status is named for what happened.
 */
export function formatOrderStatus(status: OrderStatus, fulfillmentMethod: "pickup" | "shipping" = "shipping") {
  if (status === "shipped" && fulfillmentMethod === "pickup") return "Entregado por la tienda";
  return labels[status];
}
