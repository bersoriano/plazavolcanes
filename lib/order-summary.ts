import type { OrderDetail } from "@/lib/queries/orders.types";

/**
 * Where an order goes, in one line for the decision card: city and state only.
 * The full address stays in the order details below, where it is needed to ship.
 */
export function orderDeliveryLine(fulfillmentMethod: OrderDetail["fulfillment_method"], address: OrderDetail["address"]): string {
  if (fulfillmentMethod === "pickup") return "Recolección en tu punto de entrega";
  const place = [address?.locality, address?.administrative_area].map((part) => part?.trim()).filter(Boolean).join(", ");
  return place ? `Envío a ${place}` : "Envío a domicilio";
}
