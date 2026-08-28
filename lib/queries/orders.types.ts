import type { OrderStatus } from "@/lib/database.types";

export type CartDetail = {
  id: number;
  shop: { id: number; name: string; slug: string };
  items: { id: number; quantity: number; product: { id: number; name: string; price_mxn: number; image_path: string | null } }[];
  subtotal: number;
};

export type OrderSummary = {
  id: number;
  status: OrderStatus;
  subtotal: number;
  currency_code: string;
  created_at: string;
  shop: { id: number; name: string; slug: string };
};

export type OrderDetail = OrderSummary & {
  buyer_id: string;
  current_user_id: string;
  viewer_role: "buyer" | "seller";
  fulfillment_method: "pickup" | "shipping";
  alt_contact: { name: string; phone: string | null; note: string | null } | null;
  buyer_note: string | null;
  handling_days: number;
  handling_time_zone: string;
  payment_confirmation_required: boolean;
  payment_completed_at: string | null;
  seller_cancellation_reason: "buyer_non_payment" | "inventory_unavailable" | "seller_unavailable" | "other" | null;
  accepted_at: string | null;
  ship_by_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  tracking_text: string | null;
  items: { id: number; product_name: string; unit_price: number; quantity: number; line_total: number }[];
  address: { recipient: string | null; address_line1: string | null; address_line2: string | null; locality: string | null; administrative_area: string | null; postal_code: string | null; country_code: string | null; delivery_instructions: string | null; redacted_at: string | null } | null;
  events: { id: number; event_type: string; previous_status: string | null; next_status: string; created_at: string }[];
  conversation: { id: number; messages: { id: number; sender_id: string; body: string; created_at: string }[] } | null;
  review: { id: number; rating: number; matched_description: boolean; comment: string | null; created_at: string } | null;
  dispute: { id: number; reason: string; status: "open" | "seller_responded" | "resolved"; buyer_statement: string; seller_response: string | null; resolution: string | null; resolution_notes: string | null; seller_fault: boolean | null; opened_at: string } | null;
};
