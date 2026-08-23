export type InboxRole = "buyer" | "seller";

export type ConversationType = "pre_sale" | "order";

/** The shape public.list_conversations returns, one row per thread. */
export type ConversationRow = {
  conversation_id: number;
  type: ConversationType;
  order_id: number | null;
  shop_id: number;
  shop_name: string;
  shop_slug: string;
  counterpart_label: string;
  last_message_body: string | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  unread_count: number;
};

export type ConversationSummary = {
  id: number;
  type: ConversationType;
  order_id: number | null;
  shop_id: number;
  shop_name: string;
  shop_slug: string;
  counterpart_label: string;
  unread_count: number;
  last_message: { body: string; created_at: string; sender_id: string } | null;
};

export type ThreadMessage = {
  id: number;
  sender_id: string;
  body: string;
  created_at: string;
};

export type Thread = {
  id: number;
  type: ConversationType;
  order_id: number | null;
  counterpart_label: string;
  current_user_id: string;
  messages: ThreadMessage[];
};

export function oldestFirst<T extends { created_at: string }>(entries: T[]) {
  return [...entries].sort((left, right) => left.created_at.localeCompare(right.created_at));
}

export function mapConversationRows(rows: ConversationRow[]): ConversationSummary[] {
  return rows.map((row) => ({
    id: row.conversation_id,
    type: row.type,
    order_id: row.order_id,
    shop_id: row.shop_id,
    shop_name: row.shop_name,
    shop_slug: row.shop_slug,
    counterpart_label: row.counterpart_label,
    unread_count: row.unread_count,
    // A thread opened but never written in has no message to preview.
    last_message:
      row.last_message_body && row.last_message_at && row.last_message_sender_id
        ? {
            body: row.last_message_body,
            created_at: row.last_message_at,
            sender_id: row.last_message_sender_id,
          }
        : null,
  }));
}
