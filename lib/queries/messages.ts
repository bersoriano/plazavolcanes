import { DEFAULT_CATALOG_CURRENCY } from "@/lib/catalog-locale";
import { getCatalogImageUrl } from "@/lib/storage";

export type InboxRole = "buyer" | "seller";

export type ConversationType = "pre_sale" | "order";

export type ProductStatus = "draft" | "published" | "expired" | "deleted";

/** The shape public.list_conversations returns, one row per thread. */
export type ConversationRow = {
  conversation_id: number;
  type: ConversationType;
  order_id: number | null;
  shop_id: number;
  shop_name: string;
  shop_slug: string;
  counterpart_label: string;
  product_id: number | null;
  product_name: string | null;
  product_slug: string | null;
  product_image_path: string | null;
  product_price: number | null;
  product_currency_code: string | null;
  product_status: ProductStatus | null;
  product_is_public: boolean | null;
  product_units_available: number | null;
  last_message_body: string | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  unread_count: number;
};

/**
 * The listing a thread is about, as it stands right now. Nothing here is stored on
 * the conversation, so a corrected title or a new price arrives on its own.
 */
export type ConversationProduct = {
  id: number;
  name: string;
  image_url: string | null;
  price: number;
  currency_code: string;
  /** On sale and in stock. Anything else reads as "Ya no disponible". */
  is_available: boolean;
  /** The public route only exists while the listing is published. */
  href: string | null;
};

export type ConversationSummary = {
  id: number;
  type: ConversationType;
  order_id: number | null;
  shop_id: number;
  shop_name: string;
  shop_slug: string;
  counterpart_label: string;
  product: ConversationProduct | null;
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
  viewer_role: InboxRole;
  counterpart_label: string;
  shop_name: string;
  shop_slug: string;
  product: ConversationProduct | null;
  current_user_id: string;
  messages: ThreadMessage[];
};

export function oldestFirst<T extends { created_at: string }>(entries: T[]) {
  return [...entries].sort((left, right) => left.created_at.localeCompare(right.created_at));
}

/**
 * A thread's product, or nothing at all for a general enquiry. An order thread
 * never carries one: the order, not a listing, is what that conversation is about.
 */
export function mapConversationProduct(row: ConversationRow): ConversationProduct | null {
  if (row.type !== "pre_sale" || row.product_id === null || row.product_name === null) return null;

  const isPublic = row.product_is_public === true;

  return {
    id: row.product_id,
    name: row.product_name,
    image_url: getCatalogImageUrl(row.product_image_path),
    price: Number(row.product_price ?? 0),
    currency_code: row.product_currency_code ?? DEFAULT_CATALOG_CURRENCY,
    is_available: isPublic && (row.product_units_available ?? 0) > 0,
    // A listing that left the catalogue keeps its thread, but its page is gone,
    // so the context card stops being a link rather than pointing at a 404.
    href: isPublic && row.product_slug ? `/productos/${row.product_slug}` : null,
  };
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
    product: mapConversationProduct(row),
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

/**
 * The threads that belong in an inbox: the ones somebody has written in.
 *
 * Buying opens a conversation alongside the order, before either side has said
 * anything, and the seller's first reply may never come. Those empty threads are
 * an order's business, not a message's, and listing them among real exchanges
 * only puzzles the reader. They stay reachable from the order itself, and they
 * join the inbox the moment they carry a word.
 */
export function startedConversations(conversations: ConversationSummary[]) {
  return conversations.filter((conversation) => conversation.last_message !== null);
}
