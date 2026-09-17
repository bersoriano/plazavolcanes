import type { OrderStatus } from "@/lib/database.types";
import {
  compareDates,
  deadlineUrgency,
  formatDeadline,
  PROMISE_SOON_HOURS,
  REPLY_SOON_HOURS,
  REPLY_WINDOW_HOURS,
  replyDeadline,
  sellerOrderStep,
  URGENCY_LABELS,
  type DeadlineUrgency,
} from "@/lib/seller-action-queue";
import { getSellerPublicationState } from "@/lib/seller-publication";

/**
 * The seller dashboard, organised around one question: what gets this seller
 * to their first sale, and after that, to the next one.
 *
 * Everything here is derived from rows the database already keeps — shops,
 * listings, conversations and orders. Nothing is stored about the checklist
 * itself, which is why it survives a reload and can never drift from what
 * actually happened. The one step that cannot be observed (sharing the shop)
 * stays a suggestion and is never ticked.
 */

/** Guidance, not a gate: a shop with one good listing can already sell. */
export const FIRST_SALE_LISTING_GOAL = 3;

/** Every count on the dashboard covers this many days, ending now. */
export const REPORTING_WINDOW_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export type DashboardShop = {
  id: number;
  name: string;
  slug: string;
  image_path: string | null;
  delivery_policy: string | null;
  is_publishing_approved: boolean;
  publishing_reviewed_at: string | null;
  listing_limit: number;
  is_premium: boolean;
  trust_tier: "standard" | "reliable" | "top_rated";
  created_at: string;
};

export type DashboardProduct = {
  id: number;
  shop_id: number;
  name: string;
  description: string;
  price_mxn: number;
  image_path: string | null;
  status: "draft" | "published" | "expired";
  expires_at: string | null;
  is_admin_enabled: boolean;
  condition: "new" | "used";
  used_condition: "mint" | "good" | "fair" | "bad" | "scrap" | null;
  units_available: number;
  handling_days: number;
  category_id: number | null;
  updated_at: string;
};

/** One seller-side thread, as the inbox query already describes it. */
export type DashboardConversation = {
  id: number;
  type: "pre_sale" | "order";
  order_id: number | null;
  shop_id: number;
  product_name: string | null;
  last_message: { created_at: string; sender_id: string } | null;
};

export type DashboardOrder = {
  id: number;
  shop_id: number;
  status: OrderStatus;
  created_at: string;
  accepted_at: string | null;
  ship_by_at: string | null;
  payment_confirmation_required: boolean;
  payment_completed_at: string | null;
  fulfillment_method: "pickup" | "shipping";
  /** The zone the ship-by promise was calculated in. */
  handling_time_zone: string;
  item_names: string[];
};

/**
 * An open seller_response_events row: a buyer wrote in an order thread and the
 * seller has not written since. It starts at the first unanswered message.
 */
export type DashboardReplyClock = { conversation_id: number; clock_started_at: string };

/** A section that could not be read is unknown, never zero. */
export type Loaded<T> = { ok: true; value: T } | { ok: false };

export type SellerDashboardInput = {
  userId: string;
  now: Date;
  shopLimit: number;
  shops: DashboardShop[];
  products: Loaded<DashboardProduct[]>;
  conversations: Loaded<DashboardConversation[]>;
  /** Open response clocks in the seller's own shops. */
  replyClocks: Loaded<DashboardReplyClock[]>;
  /** Orders a seller can still act on: requested, accepted, shipped, delivered. */
  openOrders: Loaded<DashboardOrder[]>;
  /** Whether any order in any of the seller's shops ever reached "completed". */
  hasCompletedSale: Loaded<boolean>;
  /** Whether the seller has ever answered a buyer who wrote first. */
  hasAnsweredBuyer: Loaded<boolean>;
  metrics: Loaded<WindowActivity>;
  /** The shop the checklist follows, when the seller picked one. */
  requestedFocusShopId: number | null;
};

/** Raw rows inside the reporting window, counted per shop here. */
export type WindowActivity = {
  inquiries: { shop_id: number }[];
  purchaseRequests: { shop_id: number }[];
  completedOrders: { shop_id: number }[];
};

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

export type ListingGap =
  | "photo"
  | "title"
  | "description"
  | "price"
  | "condition"
  | "availability"
  | "handling"
  | "category";

const GAP_LABELS: Record<ListingGap, string> = {
  photo: "foto",
  title: "título",
  description: "descripción",
  price: "precio",
  condition: "estado del producto",
  availability: "unidades disponibles",
  handling: "tiempo de preparación",
  category: "categoría",
};

/**
 * What a listing still lacks before a buyer can decide on it.
 *
 * A complete listing shows what is for sale (photo, title, description), what
 * it costs, what shape it is in, that there is one to buy, and how long it
 * takes to hand over. Category is included because publishing refuses a
 * listing without one. The shop-wide delivery policy is its own checklist step
 * rather than a gap on every listing, so one missing policy is one task.
 */
export function listingGaps(product: DashboardProduct): ListingGap[] {
  const gaps: ListingGap[] = [];
  if (!product.image_path) gaps.push("photo");
  if (product.name.trim().length < 3) gaps.push("title");
  if (product.description.trim().length < 20) gaps.push("description");
  if (!(Number(product.price_mxn) > 0)) gaps.push("price");
  if (product.condition === "used" && product.used_condition === null) gaps.push("condition");
  if (!(product.units_available >= 1)) gaps.push("availability");
  if (!(product.handling_days >= 1 && product.handling_days <= 30)) gaps.push("handling");
  if (product.category_id === null) gaps.push("category");
  return gaps;
}

export function describeGaps(gaps: ListingGap[]): string {
  const labels = gaps.map((gap) => GAP_LABELS[gap]);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} y ${labels.at(-1)}`;
}

function isPublic(product: DashboardProduct, shop: DashboardShop) {
  return getSellerPublicationState({
    status: product.status,
    expires_at: product.expires_at,
    is_admin_enabled: product.is_admin_enabled,
    is_publishing_approved: shop.is_publishing_approved,
    publishing_reviewed_at: shop.publishing_reviewed_at,
  }).isPublic;
}

export type ShopProgress = {
  shop: DashboardShop;
  listingCount: number;
  /** Buyers can see it and it has everything a buyer needs to decide. */
  readyListingCount: number;
  publicListingCount: number;
  /** Published through the status column, which is what the quota counts. */
  publishedQuotaCount: number;
  expiredCount: number;
  soldOutCount: number;
  /** The most recently touched listing a buyer cannot yet act on, if any. */
  unfinished: { product: DashboardProduct; gaps: ListingGap[] } | null;
  hasDeliveryPolicy: boolean;
  approval: "approved" | "pending" | "disabled";
};

export function summarizeShop(shop: DashboardShop, products: DashboardProduct[]): ShopProgress {
  const own = products.filter((product) => product.shop_id === shop.id);
  let readyListingCount = 0;
  let publicListingCount = 0;
  let expiredCount = 0;
  let soldOutCount = 0;
  let unfinished: ShopProgress["unfinished"] = null;

  const newestFirst = [...own].sort((left, right) => right.updated_at.localeCompare(left.updated_at));
  for (const product of newestFirst) {
    const gaps = listingGaps(product);
    const visible = isPublic(product, shop);
    if (visible) publicListingCount += 1;
    if (visible && gaps.length === 0) readyListingCount += 1;
    if (product.status === "expired" || (product.status === "published" && !visible && product.is_admin_enabled && shop.is_publishing_approved)) {
      expiredCount += 1;
    }
    if (visible && product.units_available < 1) soldOutCount += 1;
    // A draft is unfinished by definition; a public listing only when it is
    // missing something a buyer needs. Expired and sold-out listings have
    // their own tasks, so running out of units does not count here twice.
    const contentGaps = gaps.filter((gap) => gap !== "availability");
    if (!unfinished && (product.status === "draft" || (visible && contentGaps.length > 0))) {
      unfinished = { product, gaps };
    }
  }

  return {
    shop,
    listingCount: own.length,
    readyListingCount,
    publicListingCount,
    publishedQuotaCount: own.filter((product) => product.status === "published").length,
    expiredCount,
    soldOutCount,
    unfinished,
    hasDeliveryPolicy: Boolean(shop.delivery_policy?.trim()),
    approval: shop.is_publishing_approved ? "approved" : shop.publishing_reviewed_at ? "disabled" : "pending",
  };
}

// ---------------------------------------------------------------------------
// Attention
// ---------------------------------------------------------------------------

/** Orders the seller still has a move on. Everything else is history. */
const OPEN_ORDER_STATUSES: readonly OrderStatus[] = ["requested", "accepted", "shipped", "delivered"];

export function isOpenOrderStatus(status: OrderStatus) {
  return OPEN_ORDER_STATUSES.includes(status);
}

type AttentionBase = {
  id: string;
  shop: Pick<DashboardShop, "id" | "name">;
  title: string;
  /** When the wait began: the request, the first unanswered message, or the acceptance. */
  since: string;
  href: string;
  /** Only a deadline the database keeps; nothing is invented for the rest. */
  dueAt: string | null;
  urgency: DeadlineUrgency;
};

export type AttentionItem =
  | (AttentionBase & { kind: "purchase_request"; orderId: number })
  | (AttentionBase & {
      kind: "buyer_waiting";
      conversationId: number;
      /** An open response clock measures this wait, so its 24 hours apply. */
      replyWindow: boolean;
    })
  | (AttentionBase & {
      kind: "fulfill_order";
      orderId: number;
      /** Payment is confirmed before the order can be shipped or handed over. */
      step: "confirm_payment" | "ship" | "hand_over";
      fulfillmentMethod: "pickup" | "shipping";
      timeZone: string;
    });

export type AttentionGroupId = "decide" | "reply" | "payment" | "fulfil";

export type AttentionGroup = { id: AttentionGroupId; title: string; items: AttentionItem[] };

const ATTENTION_GROUP_ORDER: readonly AttentionGroupId[] = ["decide", "reply", "payment", "fulfil"];

const URGENCY_RANK: Record<DeadlineUrgency, number> = { overdue: 0, due_soon: 1, none: 2 };

function orderTitle(order: DashboardOrder) {
  const [first, ...rest] = order.item_names;
  if (!first) return `Pedido #${order.id}`;
  return rest.length ? `${first} y ${rest.length} más` : first;
}

/**
 * A buyer is waiting when they wrote the newest message in the thread.
 *
 * Unread is the wrong signal: a seller who read a question and walked away has
 * nothing unread and a buyer still waiting, while a seller who replied from
 * another device may have unread counts on a thread that needs nothing. An
 * order thread only counts while the order is open — a thank-you under a
 * completed or canceled order is not work.
 */
export function buyerIsWaiting(
  conversation: DashboardConversation,
  userId: string,
  openOrderIds: ReadonlySet<number>,
) {
  if (!conversation.last_message || conversation.last_message.sender_id === userId) return false;
  if (conversation.type === "order") {
    return conversation.order_id !== null && openOrderIds.has(conversation.order_id);
  }
  return true;
}

export function attentionGroupId(item: AttentionItem): AttentionGroupId {
  if (item.kind === "purchase_request") return "decide";
  if (item.kind === "buyer_waiting") return "reply";
  return item.step === "confirm_payment" ? "payment" : "fulfil";
}

/**
 * Passed deadlines first, then close ones, each earliest first. Everything
 * else keeps the order of its group (decisions, replies, payments, hand-overs)
 * and, inside it, the earliest deadline and then the longest wait.
 */
function compareAttention(left: AttentionItem, right: AttentionItem) {
  const groupRank = (item: AttentionItem) => ATTENTION_GROUP_ORDER.indexOf(attentionGroupId(item));
  return (
    URGENCY_RANK[left.urgency] - URGENCY_RANK[right.urgency] ||
    (left.urgency === "none" ? groupRank(left) - groupRank(right) : 0) ||
    compareDates(left.dueAt, right.dueAt) ||
    compareDates(left.since, right.since)
  );
}

export function buildAttention(
  input: Pick<SellerDashboardInput, "userId" | "now" | "shops" | "conversations" | "openOrders" | "replyClocks">,
): AttentionItem[] {
  const shopsById = new Map(input.shops.map((shop) => [shop.id, shop]));
  const items: AttentionItem[] = [];

  const openOrders = input.openOrders.ok ? input.openOrders.value : [];
  for (const order of openOrders) {
    const shop = shopsById.get(order.shop_id);
    if (!shop) continue;
    const step = sellerOrderStep(order);
    // Shipped and delivered orders wait on the buyer, not the seller.
    if (step.owner !== "seller") continue;
    const base = {
      id: `order-${order.id}`,
      shop: { id: shop.id, name: shop.name },
      orderId: order.id,
      title: orderTitle(order),
      href: `/panel/pedidos/${order.id}`,
    };
    const { kind } = step;
    if (kind === "decide") {
      items.push({ kind: "purchase_request", ...base, since: order.created_at, dueAt: null, urgency: "none" });
      continue;
    }
    items.push({
      kind: "fulfill_order",
      ...base,
      step: kind,
      fulfillmentMethod: order.fulfillment_method,
      timeZone: order.handling_time_zone,
      since: order.accepted_at ?? order.created_at,
      dueAt: step.dueAt,
      urgency: deadlineUrgency(step.dueAt, input.now, PROMISE_SOON_HOURS),
    });
  }

  if (input.conversations.ok) {
    // When orders could not be read, an order thread cannot be judged open, so
    // only enquiries are listed rather than guessing about the rest.
    const openOrderIds = new Set(openOrders.filter((order) => isOpenOrderStatus(order.status)).map((order) => order.id));
    const clocks = new Map<number, string>(
      input.replyClocks.ok ? input.replyClocks.value.map((clock) => [clock.conversation_id, clock.clock_started_at]) : [],
    );
    for (const conversation of input.conversations.value) {
      const shop = shopsById.get(conversation.shop_id);
      if (!shop || !conversation.last_message) continue;
      if (!buyerIsWaiting(conversation, input.userId, openOrderIds)) continue;
      // The response rate only times order threads, so a question asked before
      // buying never gets a deadline, whatever the clocks say.
      const clockStartedAt = conversation.type === "order" ? clocks.get(conversation.id) : undefined;
      const dueAt = clockStartedAt ? replyDeadline(clockStartedAt) : null;
      items.push({
        kind: "buyer_waiting",
        id: `conversation-${conversation.id}`,
        shop: { id: shop.id, name: shop.name },
        conversationId: conversation.id,
        title:
          conversation.type === "order" && conversation.order_id !== null
            ? `Mensaje sobre el pedido #${conversation.order_id}`
            : conversation.product_name
              ? `Pregunta sobre ${conversation.product_name}`
              : "Pregunta sobre tu tienda",
        // The clock starts at the first unanswered message, which is how long
        // the buyer has really waited; the newest message may be later.
        since: clockStartedAt ?? conversation.last_message.created_at,
        href: `/mensajes/${conversation.id}`,
        dueAt,
        urgency: deadlineUrgency(dueAt, input.now, REPLY_SOON_HOURS),
        replyWindow: dueAt !== null,
      });
    }
  }

  return items.sort(compareAttention);
}

function attentionGroupTitle(id: AttentionGroupId, items: AttentionItem[]) {
  if (id === "decide") return "Solicitudes por decidir";
  if (id === "reply") return "Compradores esperando respuesta";
  if (id === "payment") return "Pagos por confirmar";
  const steps = new Set(items.map((item) => (item.kind === "fulfill_order" ? item.step : null)));
  if (steps.has("ship") && steps.has("hand_over")) return "Pedidos por enviar o entregar";
  return steps.has("ship") ? "Pedidos por enviar" : "Pedidos por entregar";
}

/** The queue by the action each item needs, keeping its order; empty groups are left out. */
export function groupAttention(items: AttentionItem[]): AttentionGroup[] {
  return ATTENTION_GROUP_ORDER.map((id) => {
    const grouped = items.filter((item) => attentionGroupId(item) === id);
    return { id, title: attentionGroupTitle(id, grouped), items: grouped };
  }).filter((group) => group.items.length > 0);
}

// ---------------------------------------------------------------------------
// First-sale checklist
// ---------------------------------------------------------------------------

export type ChecklistStepId = "create_shop" | "publish_listings" | "delivery" | "share" | "first_reply" | "first_sale";

export type ChecklistStep = {
  id: ChecklistStepId;
  title: string;
  detail: string;
  /** "suggestion" is never ticked: nothing observable proves it happened. */
  state: "done" | "todo" | "suggestion" | "unknown";
  action: { label: string; href: string } | null;
};

export type FirstSaleChecklist = {
  shop: DashboardShop | null;
  steps: ChecklistStep[];
  completed: number;
  /** Steps that can be ticked; the suggestion is left out of the count. */
  total: number;
};

/**
 * The shop the checklist follows. A seller with several shops can pick one;
 * otherwise it is the one closest to selling, so the guidance starts from the
 * shop they have put the most into rather than the newest empty one.
 */
export function pickFocusShop(progress: ShopProgress[], requestedShopId: number | null): ShopProgress | null {
  if (!progress.length) return null;
  const requested = requestedShopId === null ? undefined : progress.find((entry) => entry.shop.id === requestedShopId);
  if (requested) return requested;

  return [...progress].sort(
    (left, right) =>
      right.readyListingCount - left.readyListingCount ||
      right.publicListingCount - left.publicListingCount ||
      right.listingCount - left.listingCount ||
      right.shop.created_at.localeCompare(left.shop.created_at),
  )[0];
}

function listingStepDetail(focus: ShopProgress) {
  if (focus.approval === "pending") {
    return "Administración está revisando tu tienda. Puedes preparar tus productos mientras tanto.";
  }
  if (focus.approval === "disabled") {
    return "Administración deshabilitó las publicaciones de esta tienda. Escríbenos si crees que es un error.";
  }
  if (focus.readyListingCount >= FIRST_SALE_LISTING_GOAL) {
    return `${focus.readyListingCount} productos completos a la vista.`;
  }
  const base = `${focus.readyListingCount} de ${FIRST_SALE_LISTING_GOAL} productos completos a la vista.`;
  return focus.readyListingCount > 0
    ? `${base} Ya puedes vender; más opciones ayudan a quien visita tu tienda a decidirse.`
    : `${base} Un producto completo tiene foto, título, precio, estado, unidades y tiempo de preparación.`;
}

export function buildChecklist(
  input: Pick<SellerDashboardInput, "hasAnsweredBuyer" | "hasCompletedSale" | "shopLimit">,
  focus: ShopProgress | null,
  attention: AttentionItem[],
): FirstSaleChecklist {
  const shopHref = focus ? `/panel/tiendas/${focus.shop.id}` : null;
  const waitingBuyer = attention.find((item) => item.kind === "buyer_waiting");
  const pendingRequest = attention.find((item) => item.kind !== "buyer_waiting");

  const steps: ChecklistStep[] = [
    {
      id: "create_shop",
      title: "Crea tu tienda",
      detail: focus ? `${focus.shop.name} ya está abierta.` : "Ponle nombre, cuenta su historia y elige dónde entregas.",
      state: focus ? "done" : "todo",
      action: focus ? null : input.shopLimit > 0 ? { label: "Crear tienda", href: "/panel/tiendas/nueva" } : null,
    },
    {
      id: "publish_listings",
      title: `Publica ${FIRST_SALE_LISTING_GOAL} productos completos`,
      detail: focus ? listingStepDetail(focus) : "Primero crea tu tienda.",
      state: focus && focus.readyListingCount >= FIRST_SALE_LISTING_GOAL ? "done" : "todo",
      action: !focus
        ? null
        : focus.unfinished
          ? { label: "Terminar producto", href: `/panel/productos/${focus.unfinished.product.id}/editar` }
          : focus.readyListingCount < FIRST_SALE_LISTING_GOAL && focus.approval !== "disabled"
            ? { label: "Agregar producto", href: `/panel/tiendas/${focus.shop.id}/productos/nuevo` }
            : null,
    },
    {
      id: "delivery",
      title: "Explica cómo entregas",
      detail: focus?.hasDeliveryPolicy
        ? "Tu política de entregas ya aparece en tu tienda."
        : "Cuenta cómo envías o dónde entregas en persona, para que nadie tenga que preguntarlo.",
      state: focus?.hasDeliveryPolicy ? "done" : "todo",
      action: focus && !focus.hasDeliveryPolicy ? { label: "Configurar entregas", href: `${shopHref}/ajustes#delivery-policy-title` } : null,
    },
    {
      id: "share",
      title: "Comparte tu tienda",
      detail: "Envía el enlace a tus contactos o publícalo en tus redes. Este paso no se marca solo: no sabemos a quién se lo enviaste.",
      state: "suggestion",
      action: null,
    },
    {
      id: "first_reply",
      title: "Responde tu primera consulta",
      detail: !input.hasAnsweredBuyer.ok
        ? "No pudimos revisar tus conversaciones."
        : input.hasAnsweredBuyer.value
          ? "Ya respondiste a un comprador."
          : waitingBuyer
            ? `Te escribieron desde ${waitingBuyer.shop.name}.`
            : "Cuando un comprador te escriba, aparecerá arriba para que respondas.",
      state: !input.hasAnsweredBuyer.ok ? "unknown" : input.hasAnsweredBuyer.value ? "done" : "todo",
      action: waitingBuyer && !(input.hasAnsweredBuyer.ok && input.hasAnsweredBuyer.value) ? { label: "Responder", href: waitingBuyer.href } : null,
    },
    {
      id: "first_sale",
      title: "Completa tu primer pedido",
      detail: !input.hasCompletedSale.ok
        ? "No pudimos revisar tus pedidos."
        : input.hasCompletedSale.value
          ? "El comprador confirmó que recibió su pedido."
          : "Un pedido se completa cuando el comprador confirma que lo recibió.",
      state: !input.hasCompletedSale.ok ? "unknown" : input.hasCompletedSale.value ? "done" : "todo",
      action: pendingRequest ? { label: "Ver pedido", href: pendingRequest.href } : null,
    },
  ];

  const countable = steps.filter((step) => step.state !== "suggestion");
  return {
    shop: focus?.shop ?? null,
    steps,
    completed: countable.filter((step) => step.state === "done").length,
    total: countable.length,
  };
}

// ---------------------------------------------------------------------------
// Ongoing tasks, once the first sale is behind them
// ---------------------------------------------------------------------------

export type OngoingTask = {
  id: string;
  shop: Pick<DashboardShop, "id" | "name">;
  title: string;
  detail: string;
  action: { label: string; href: string };
};

export function buildOngoingTasks(progress: ShopProgress[]): OngoingTask[] {
  const tasks: OngoingTask[] = [];
  for (const entry of progress) {
    const shop = { id: entry.shop.id, name: entry.shop.name };
    const shopHref = `/panel/tiendas/${entry.shop.id}`;
    if (entry.approval !== "approved") continue;
    if (!entry.hasDeliveryPolicy && entry.publicListingCount > 0) {
      tasks.push({ id: `delivery-${shop.id}`, shop, title: "Explica cómo entregas", detail: "Tu tienda aún no tiene política de entregas.", action: { label: "Configurar entregas", href: `${shopHref}/ajustes#delivery-policy-title` } });
    }
    if (entry.soldOutCount > 0) {
      tasks.push({ id: `sold-out-${shop.id}`, shop, title: "Repón inventario", detail: `${entry.soldOutCount} ${entry.soldOutCount === 1 ? "producto se quedó" : "productos se quedaron"} sin unidades.`, action: { label: "Ver publicados", href: `${shopHref}?estado=publicados` } });
    }
    if (entry.expiredCount > 0) {
      tasks.push({ id: `expired-${shop.id}`, shop, title: "Renueva publicaciones vencidas", detail: `${entry.expiredCount} ${entry.expiredCount === 1 ? "producto dejó" : "productos dejaron"} de estar a la vista.`, action: { label: "Ver vencidos", href: `${shopHref}?estado=vencidos` } });
    }
    if (entry.unfinished) {
      const gaps = entry.unfinished.gaps;
      tasks.push({
        id: `unfinished-${entry.unfinished.product.id}`,
        shop,
        title: `Termina ${entry.unfinished.product.name}`,
        detail: gaps.length ? `Le falta ${describeGaps(gaps)}.` : "Está listo como borrador; publícalo cuando quieras.",
        action: { label: "Terminar producto", href: `/panel/productos/${entry.unfinished.product.id}/editar` },
      });
    }
  }
  return tasks;
}

// ---------------------------------------------------------------------------
// The one next action
// ---------------------------------------------------------------------------

export type PrimaryAction = {
  kind:
    | "respond"
    | "review_request"
    | "fulfill_order"
    | "create_shop"
    | "shop_limit"
    | "add_first_product"
    | "finish_listing"
    | "awaiting_approval"
    | "publishing_disabled"
    | "renew_listings"
    | "configure_delivery"
    | "share_shop"
    | "keep_selling"
    | "listings_unavailable";
  eyebrow: string;
  title: string;
  detail: string;
  /** The shop the action belongs to, so several shops never blur together. */
  shop: Pick<DashboardShop, "id" | "name"> | null;
  action: { label: string; href: string } | null;
  /** Set only when the next step is sharing, which needs the public address. */
  share: Pick<DashboardShop, "name" | "slug"> | null;
};

export function choosePrimaryAction(
  input: Pick<SellerDashboardInput, "shopLimit">,
  attention: AttentionItem[],
  focus: ShopProgress | null,
  ongoing: OngoingTask[],
  { hasCompletedSale, listingsLoaded }: { hasCompletedSale: boolean; listingsLoaded: boolean },
): PrimaryAction {
  const urgent = attention[0];
  if (urgent) {
    const shop = urgent.shop;
    const share = null;
    if (urgent.kind === "purchase_request") {
      return { kind: "review_request", eyebrow: "Solicitud de compra", title: "Revisa la solicitud", detail: `${urgent.title} · ${urgent.shop.name}. Acepta o rechaza; el comprador verá tu decisión en su compra.`, shop, action: { label: "Revisar solicitud", href: urgent.href }, share };
    }
    if (urgent.kind === "buyer_waiting") {
      const window =
        urgent.urgency === "overdue"
          ? ` Pasaron más de ${REPLY_WINDOW_HOURS} h sin respuesta.`
          : urgent.urgency === "due_soon"
            ? ` Su plazo de ${REPLY_WINDOW_HOURS} h para respuesta está por vencer.`
            : "";
      return { kind: "respond", eyebrow: "Un comprador espera", title: "Responde al comprador", detail: `${urgent.title} · ${urgent.shop.name}.${window}`, shop, action: { label: "Responder", href: urgent.href }, share };
    }
    const promise =
      urgent.urgency === "overdue"
        ? " La fecha comprometida ya pasó."
        : urgent.urgency === "due_soon"
          ? " La fecha comprometida está por vencer."
          : "";
    return {
      kind: "fulfill_order",
      eyebrow: "Pedido aceptado",
      title: urgent.step === "confirm_payment" ? "Confirma el pago" : urgent.step === "ship" ? "Envía el pedido" : "Entrega el pedido",
      detail: `${urgent.title} · ${urgent.shop.name}.${promise}`,
      shop,
      action: { label: "Ver pedido", href: urgent.href },
      share,
    };
  }

  if (!focus) {
    return input.shopLimit > 0
      ? { kind: "create_shop", eyebrow: "Primer paso", title: "Crea tu tienda", detail: "Ponle nombre y cuenta su historia. Después agregas tus productos.", shop: null, action: { label: "Crear tienda", href: "/panel/tiendas/nueva" }, share: null }
      : { kind: "shop_limit", eyebrow: "Tiendas", title: "Aún no puedes crear tiendas", detail: "Administración puede ampliar tu límite cuando lo necesites.", shop: null, action: null, share: null };
  }

  const shop = focus.shop;
  const shopRef = { id: shop.id, name: shop.name };
  const share = null;

  // Without the catalogue every setup step below would be a guess, and "add
  // your first product" to somebody with twenty would be worse than nothing.
  if (!listingsLoaded) {
    return { kind: "listings_unavailable", eyebrow: shop.name, title: "No pudimos cargar tus productos", detail: "Vuelve a cargar el panel en un momento. Tu catálogo sigue disponible desde tu tienda.", shop: shopRef, action: { label: "Ir al catálogo", href: `/panel/tiendas/${shop.id}` }, share };
  }

  if (hasCompletedSale) {
    const next = ongoing[0];
    if (next) return { kind: "keep_selling", eyebrow: next.shop.name, title: next.title, detail: next.detail, shop: next.shop, action: next.action, share };
    return { kind: "share_shop", eyebrow: "Todo al día", title: "Comparte tu tienda", detail: "No tienes pendientes. Recuérdale a tus clientes dónde encontrarte.", shop: shopRef, action: null, share: { name: shop.name, slug: shop.slug } };
  }

  if (focus.listingCount === 0) {
    return focus.approval === "disabled"
      ? { kind: "publishing_disabled", eyebrow: shop.name, title: "Publicaciones deshabilitadas", detail: "Administración deshabilitó las publicaciones de esta tienda.", shop: shopRef, action: null, share }
      : { kind: "add_first_product", eyebrow: shop.name, title: "Agrega tu primer producto", detail: "Sube una buena foto, ponle precio y cuenta en qué estado está.", shop: shopRef, action: { label: "Agregar producto", href: `/panel/tiendas/${shop.id}/productos/nuevo` }, share };
  }

  if (focus.approval === "disabled") {
    return { kind: "publishing_disabled", eyebrow: shop.name, title: "Publicaciones deshabilitadas", detail: "Administración deshabilitó las publicaciones de esta tienda. Tus productos siguen guardados.", shop: shopRef, action: { label: "Ver catálogo", href: `/panel/tiendas/${shop.id}` }, share };
  }

  if (focus.readyListingCount === 0 && focus.unfinished) {
    const gaps = focus.unfinished.gaps;
    return {
      kind: "finish_listing",
      eyebrow: shop.name,
      title: `Termina ${focus.unfinished.product.name}`,
      detail: gaps.length ? `Le falta ${describeGaps(gaps)}.` : "Ya tiene todo; publícalo para que los compradores lo vean.",
      shop: shopRef,
      action: { label: "Terminar producto", href: `/panel/productos/${focus.unfinished.product.id}/editar` },
      share,
    };
  }

  if (focus.approval === "pending") {
    return { kind: "awaiting_approval", eyebrow: shop.name, title: "Tu tienda está en revisión", detail: "Tus productos aparecerán en la plaza cuando administración apruebe la tienda. Mientras, puedes preparar tu política de entregas.", shop: shopRef, action: focus.hasDeliveryPolicy ? null : { label: "Configurar entregas", href: `/panel/tiendas/${shop.id}/ajustes#delivery-policy-title` }, share };
  }

  if (focus.publicListingCount === 0 && focus.expiredCount > 0) {
    return { kind: "renew_listings", eyebrow: shop.name, title: "Renueva tus publicaciones", detail: "Tus productos vencieron y ya no están a la vista.", shop: shopRef, action: { label: "Ver vencidos", href: `/panel/tiendas/${shop.id}?estado=vencidos` }, share };
  }

  if (!focus.hasDeliveryPolicy) {
    return { kind: "configure_delivery", eyebrow: shop.name, title: "Explica cómo entregas", detail: "Los compradores preguntan antes de pedir. Cuéntales si envías, dónde entregas en persona y cuánto tardas.", shop: shopRef, action: { label: "Configurar entregas", href: `/panel/tiendas/${shop.id}/ajustes#delivery-policy-title` }, share };
  }

  if (focus.readyListingCount === 0) {
    // Public, but nothing a buyer can fully act on yet.
    return { kind: "add_first_product", eyebrow: shop.name, title: "Completa un producto", detail: "Revisa que tus productos tengan foto, precio, estado y unidades.", shop: shopRef, action: { label: "Ver catálogo", href: `/panel/tiendas/${shop.id}` }, share };
  }

  return {
    kind: "share_shop",
    eyebrow: shop.name,
    title: "Comparte tu tienda",
    detail:
      focus.readyListingCount < FIRST_SALE_LISTING_GOAL
        ? "Tu tienda ya puede recibir pedidos. Envía el enlace a quien pueda interesarle; también puedes sumar más productos."
        : "Tu tienda está lista. Envía el enlace a quien pueda interesarle.",
    shop: shopRef,
    action: null,
    share: { name: shop.name, slug: shop.slug },
  };
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export type MetricCounts = { inquiries: number; purchaseRequests: number; completedOrders: number };

export type DashboardMetrics =
  | { ok: false; windowStart: Date; windowEnd: Date }
  | {
      ok: true;
      windowStart: Date;
      windowEnd: Date;
      total: MetricCounts;
      /** Only the seller's own shops, each counted from its own rows. */
      byShop: { shop: Pick<DashboardShop, "id" | "name">; counts: MetricCounts }[];
    };

export function reportingWindow(now: Date) {
  return { windowStart: new Date(now.getTime() - REPORTING_WINDOW_DAYS * DAY_MS), windowEnd: now };
}

export function buildMetrics(input: Pick<SellerDashboardInput, "now" | "shops" | "metrics">): DashboardMetrics {
  const window = reportingWindow(input.now);
  if (!input.metrics.ok) return { ok: false, ...window };

  const { inquiries, purchaseRequests, completedOrders } = input.metrics.value;
  const count = (rows: { shop_id: number }[], shopId?: number) =>
    rows.filter((row) => (shopId === undefined ? input.shops.some((shop) => shop.id === row.shop_id) : row.shop_id === shopId)).length;

  return {
    ok: true,
    ...window,
    total: { inquiries: count(inquiries), purchaseRequests: count(purchaseRequests), completedOrders: count(completedOrders) },
    byShop: input.shops.map((shop) => ({
      shop: { id: shop.id, name: shop.name },
      counts: { inquiries: count(inquiries, shop.id), purchaseRequests: count(purchaseRequests, shop.id), completedOrders: count(completedOrders, shop.id) },
    })),
  };
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

export type SellerDashboard = {
  primary: PrimaryAction;
  attention: AttentionItem[];
  attentionGroups: AttentionGroup[];
  /**
   * Sections that failed to load, so the page can say so instead of showing
   * zero. Without the response clocks threads are still listed, only without
   * their reply deadline.
   */
  unavailable: { attention: boolean; deadlines: boolean; listings: boolean };
  mode: "first_sale" | "ongoing" | "unknown";
  checklist: FirstSaleChecklist;
  ongoing: OngoingTask[];
  metrics: DashboardMetrics;
  shops: ShopProgress[];
  focusShopId: number | null;
  canCreateShop: boolean;
  shopLimit: number;
};

export function buildSellerDashboard(input: SellerDashboardInput): SellerDashboard {
  const products = input.products.ok ? input.products.value : [];
  const shops = input.shops.map((shop) => summarizeShop(shop, products));
  const attention = buildAttention(input);
  const focus = pickFocusShop(shops, input.requestedFocusShopId);
  const ongoing = buildOngoingTasks(shops);
  const hasCompletedSale = input.hasCompletedSale.ok && input.hasCompletedSale.value;

  return {
    primary: choosePrimaryAction(input, attention, focus, ongoing, { hasCompletedSale, listingsLoaded: input.products.ok }),
    attention,
    attentionGroups: groupAttention(attention),
    unavailable: {
      attention: !input.conversations.ok || !input.openOrders.ok,
      deadlines: !input.replyClocks.ok,
      listings: !input.products.ok,
    },
    mode: !input.hasCompletedSale.ok ? "unknown" : hasCompletedSale ? "ongoing" : "first_sale",
    checklist: buildChecklist(input, focus, attention),
    ongoing,
    metrics: buildMetrics(input),
    shops,
    focusShopId: focus?.shop.id ?? null,
    canCreateShop: input.shops.length < input.shopLimit,
    shopLimit: input.shopLimit,
  };
}

// ---------------------------------------------------------------------------
// Copy helpers
// ---------------------------------------------------------------------------

export function formatWaiting(since: string, now: Date) {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / 60000));
  if (minutes < 60) return minutes <= 1 ? "hace un momento" : `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "hace 1 día" : `hace ${days} días`;
}

/** Rounded up: "within the next 4 h" stays true until the last minute. */
function formatRemaining(dueAt: string, now: Date) {
  const minutes = Math.max(1, Math.ceil((Date.parse(dueAt) - now.getTime()) / 60000));
  if (minutes < 60) return `en los próximos ${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  return hours === 1 ? "en la próxima hora" : `en las próximas ${hours} h`;
}

export type AttentionTiming = {
  waiting: string;
  /** Present only when the database keeps a deadline for the item. */
  deadline: string | null;
  urgencyLabel: string | null;
};

/**
 * How long an item has waited and what it is due by, in words. A collected
 * order is handed over, never shipped, and a promise reads in the time zone it
 * was made in.
 */
export function attentionTiming(item: AttentionItem, now: Date): AttentionTiming {
  const waited = formatWaiting(item.since, now);
  if (item.kind === "purchase_request") {
    return { waiting: `Recibida ${waited}`, deadline: null, urgencyLabel: null };
  }
  if (item.kind === "buyer_waiting") {
    if (!item.replyWindow || !item.dueAt) return { waiting: `Escribió ${waited}`, deadline: null, urgencyLabel: null };
    return {
      waiting: `Sin respuesta desde ${waited}`,
      deadline:
        item.urgency === "overdue"
          ? `Pasaron más de ${REPLY_WINDOW_HOURS} h sin respuesta`
          : `Responde ${formatRemaining(item.dueAt, now)}`,
      urgencyLabel: URGENCY_LABELS[item.urgency],
    };
  }
  if (!item.dueAt) return { waiting: `Aceptado ${waited}`, deadline: null, urgencyLabel: null };
  const pickup = item.fulfillmentMethod === "pickup";
  const when = formatDeadline(item.dueAt, item.timeZone);
  const verb = pickup ? "Entrega" : "Envía";
  return {
    waiting: `Aceptado ${waited}`,
    deadline:
      item.urgency === "overdue"
        ? `La fecha para ${pickup ? "entregar" : "enviar"} ya pasó (${when})`
        : item.step === "confirm_payment"
          ? `Confirma el pago y ${verb.toLowerCase()} antes del ${when}`
          : `${verb} antes del ${when}`,
    urgencyLabel: URGENCY_LABELS[item.urgency],
  };
}
