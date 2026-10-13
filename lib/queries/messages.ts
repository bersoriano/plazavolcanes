import { DEFAULT_CATALOG_CURRENCY } from "@/lib/catalog-locale";

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
  order_item_name: string | null;
  order_item_image_path: string | null;
  order_item_count: number | null;
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

/**
 * What an order thread's order holds: its first line, named as it was bought, and
 * how many more lines came with it. The picture is the product's current cover,
 * and goes when the listing does.
 */
export type ConversationOrderItem = {
  name: string;
  image_url: string | null;
  more: number;
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
  order_item: ConversationOrderItem | null;
  unread_count: number;
  last_message: { body: string; created_at: string; sender_id: string } | null;
};

/** A thread in the one inbox, which holds what you buy and what you sell together. */
export type InboxEntry = ConversationSummary & { role: InboxRole };

export type InboxFilter = "all" | "unread" | "buying" | "selling";

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
  order_item: ConversationOrderItem | null;
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
export function mapConversationProduct(
  row: ConversationRow,
  imageUrls: ReadonlyMap<string, string> = new Map(),
): ConversationProduct | null {
  if (row.type !== "pre_sale" || row.product_id === null || row.product_name === null) return null;

  const isPublic = row.product_is_public === true;

  return {
    id: row.product_id,
    name: row.product_name,
    image_url: row.product_image_path
      ? (imageUrls.get(row.product_image_path) ?? null)
      : null,
    price: Number(row.product_price ?? 0),
    currency_code: row.product_currency_code ?? DEFAULT_CATALOG_CURRENCY,
    is_available: isPublic && (row.product_units_available ?? 0) > 0,
    // A listing that left the catalogue keeps its thread, but its page is gone,
    // so the context card stops being a link rather than pointing at a 404.
    href: isPublic && row.product_slug ? `/productos/${row.product_slug}` : null,
  };
}

export function mapConversationOrderItem(
  row: ConversationRow,
  imageUrls: ReadonlyMap<string, string> = new Map(),
): ConversationOrderItem | null {
  // Falsy rather than null: a database that predates the columns sends none at all.
  if (row.type !== "order" || !row.order_item_name) return null;

  return {
    name: row.order_item_name,
    image_url: row.order_item_image_path
      ? (imageUrls.get(row.order_item_image_path) ?? null)
      : null,
    more: Math.max(0, (row.order_item_count ?? 1) - 1),
  };
}

/** "Reloj de cuerda y 2 más": an order by its first line and how many came with it. */
export function orderItemLabel(item: ConversationOrderItem) {
  return item.more > 0 ? `${item.name} y ${item.more} más` : item.name;
}

export function mapConversationRows(
  rows: ConversationRow[],
  imageUrls: ReadonlyMap<string, string> = new Map(),
): ConversationSummary[] {
  return rows.map((row) => ({
    id: row.conversation_id,
    type: row.type,
    order_id: row.order_id,
    shop_id: row.shop_id,
    shop_name: row.shop_name,
    shop_slug: row.shop_slug,
    counterpart_label: row.counterpart_label,
    product: mapConversationProduct(row, imageUrls),
    order_item: mapConversationOrderItem(row, imageUrls),
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

function sentAt(conversation: ConversationSummary) {
  return conversation.last_message ? Date.parse(conversation.last_message.created_at) : 0;
}

/**
 * One inbox out of the two lists the database keeps: the threads somebody has
 * written in, each marked with the side the reader is on, newest first.
 */
export function mergeInbox(
  buying: ConversationSummary[],
  selling: ConversationSummary[],
): InboxEntry[] {
  const seen = new Set<number>();
  const entries: InboxEntry[] = [];

  for (const [role, conversations] of [
    ["buyer", buying],
    ["seller", selling],
  ] as const) {
    for (const conversation of startedConversations(conversations)) {
      if (seen.has(conversation.id)) continue;
      seen.add(conversation.id);
      entries.push({ ...conversation, role });
    }
  }

  return entries.sort((left, right) => sentAt(right) - sentAt(left) || right.id - left.id);
}

/** "José Peña" is found by "jose pena": nobody types accents into a search box. */
function fold(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Everything a row shows, which is everything a search of the inbox can find. */
function searchableText(entry: InboxEntry) {
  return fold(
    [
      entry.counterpart_label,
      entry.shop_name,
      entry.product?.name,
      entry.order_item?.name,
      entry.order_id ? `pedido #${entry.order_id} pedido ${entry.order_id}` : null,
      entry.last_message?.body,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

/**
 * `openId` is the thread on screen. Opening a thread reads it, and it stays
 * under "unread" while it is open rather than vanishing from under the reader.
 */
export function filterInbox(
  entries: InboxEntry[],
  filter: InboxFilter,
  query = "",
  openId: number | null = null,
) {
  const needle = fold(query.trim());

  return entries.filter((entry) => {
    if (filter === "unread" && entry.unread_count === 0 && entry.id !== openId) return false;
    if (filter === "buying" && entry.role !== "buyer") return false;
    if (filter === "selling" && entry.role !== "seller") return false;

    return needle ? searchableText(entry).includes(needle) : true;
  });
}

/** Unread messages, in all and on each side, as the header's badge counts them. */
export function unreadTotals(entries: InboxEntry[]) {
  const totals = { all: 0, buying: 0, selling: 0 };

  for (const entry of entries) {
    totals.all += entry.unread_count;
    totals[entry.role === "buyer" ? "buying" : "selling"] += entry.unread_count;
  }

  return totals;
}
