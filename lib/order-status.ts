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

export function formatOrderStatus(status: OrderStatus) {
  return labels[status];
}
