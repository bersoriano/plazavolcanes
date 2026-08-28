import type { OrderDetail } from "@/lib/queries/orders.types";

export type { OrderDetail } from "@/lib/queries/orders.types";

/**
 * The shape PostgREST actually returns for the order detail select.
 *
 * order_addresses, conversations, order_reviews and order_disputes are to-one
 * embeds — order_id is a primary key or unique on each — so PostgREST returns a
 * single object, or null when the row does not exist. Only order_items and
 * order_events come back as arrays.
 */
export type OrderDetailRow = Omit<
  OrderDetail,
  | "shop"
  | "items"
  | "address"
  | "events"
  | "conversation"
  | "review"
  | "dispute"
  | "alt_contact"
  | "current_user_id"
  | "viewer_role"
> & {
  alt_contact_name: string | null;
  alt_contact_phone: string | null;
  alt_contact_note: string | null;
  shops: OrderDetail["shop"];
  order_items: OrderDetail["items"];
  order_addresses: OrderDetail["address"];
  order_events: OrderDetail["events"];
  conversations: OrderDetail["conversation"];
  order_reviews: OrderDetail["review"];
  order_disputes: OrderDetail["dispute"];
};

function oldestFirst<T extends { created_at: string }>(entries: T[]) {
  return [...entries].sort((left, right) => left.created_at.localeCompare(right.created_at));
}

export function mapOrderDetailRow(
  row: OrderDetailRow | null,
  userId: string,
): OrderDetail | null {
  if (!row) return null;

  const conversation = row.conversations;

  return {
    ...row,
    current_user_id: userId,
    viewer_role: row.buyer_id === userId ? "buyer" : "seller",
    fulfillment_method: row.fulfillment_method,
    alt_contact: row.alt_contact_name
      ? {
          name: row.alt_contact_name,
          phone: row.alt_contact_phone,
          note: row.alt_contact_note,
        }
      : null,
    shop: row.shops,
    items: row.order_items,
    address: row.order_addresses ?? null,
    events: oldestFirst(row.order_events),
    conversation: conversation
      ? { ...conversation, messages: oldestFirst(conversation.messages) }
      : null,
    review: row.order_reviews ?? null,
    dispute: row.order_disputes ?? null,
  };
}
