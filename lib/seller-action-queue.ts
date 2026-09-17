import type { OrderStatus } from "@/lib/database.types";
import { formatOrderStatus } from "@/lib/order-status";

/**
 * Whose move an order is, and by when.
 *
 * The panel's queue, the orders page and the order itself all read this, so
 * the three never disagree about what the seller has to do next. Only
 * deadlines the database actually keeps are used: the ship-by promise fixed
 * when an order is accepted, the 24 hours the response rate gives an order
 * thread, and the seven days after which a received order completes on its
 * own. A purchase request and a question asked before buying have no
 * deadline, and none is made up for them.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** What seller_response_events.answered_within_24_hours measures. */
export const REPLY_WINDOW_HOURS = 24;

/** private.auto_complete_orders, which also skips orders with an open dispute. */
export const AUTO_COMPLETE_DAYS = 7;

/** A promised date this close is flagged. */
export const PROMISE_SOON_HOURS = 24;

/**
 * Half the reply window. Every open clock ends within 24 hours, so flagging
 * the whole window would flag every message the moment it arrives.
 */
export const REPLY_SOON_HOURS = 12;

/** The shop default; an accepted order always carries a zone Postgres understood. */
const FALLBACK_TIME_ZONE = "America/Mexico_City";

export type FulfillmentMethod = "pickup" | "shipping";

export type SellerOrderFacts = {
  status: OrderStatus;
  fulfillment_method: FulfillmentMethod;
  payment_confirmation_required: boolean;
  payment_completed_at: string | null;
  ship_by_at: string | null;
  /** Only a received order needs it, to say when it completes on its own. */
  delivered_at?: string | null;
  handling_time_zone: string;
};

export type SellerOrderStep =
  | { kind: "decide" | "confirm_payment" | "ship" | "hand_over"; owner: "seller"; dueAt: string | null }
  | { kind: "await_receipt"; owner: "buyer"; dueAt: null }
  | { kind: "await_confirmation"; owner: "buyer"; dueAt: null; autoCompleteAt: string | null }
  | { kind: "closed"; owner: "nobody"; dueAt: null };

export type DeadlineUrgency = "overdue" | "due_soon" | "none";

function addMs(value: string, ms: number) {
  return new Date(Date.parse(value) + ms).toISOString();
}

export function sellerOrderStep(order: SellerOrderFacts): SellerOrderStep {
  switch (order.status) {
    case "requested":
      // Nothing expires a request: it waits on the seller for as long as it takes.
      return { kind: "decide", owner: "seller", dueAt: null };
    case "accepted":
      // Shipping is refused until payment is confirmed, but the ship-by promise
      // was fixed at acceptance and keeps running meanwhile.
      if (order.payment_confirmation_required && !order.payment_completed_at) {
        return { kind: "confirm_payment", owner: "seller", dueAt: order.ship_by_at };
      }
      return { kind: order.fulfillment_method === "pickup" ? "hand_over" : "ship", owner: "seller", dueAt: order.ship_by_at };
    case "shipped":
      return { kind: "await_receipt", owner: "buyer", dueAt: null };
    case "delivered":
      return {
        kind: "await_confirmation",
        owner: "buyer",
        dueAt: null,
        autoCompleteAt: order.delivered_at ? addMs(order.delivered_at, AUTO_COMPLETE_DAYS * DAY_MS) : null,
      };
    default:
      return { kind: "closed", owner: "nobody", dueAt: null };
  }
}

/** Urgency in words, so it never rests on colour alone. */
export const URGENCY_LABELS: Record<DeadlineUrgency, string | null> = {
  overdue: "Plazo vencido",
  due_soon: "Vence pronto",
  none: null,
};

/** The seller's move, as a short instruction. */
export const SELLER_STEP_TITLES: Record<Extract<SellerOrderStep, { owner: "seller" }>["kind"], string> = {
  decide: "Acepta o rechaza la solicitud",
  confirm_payment: "Confirma el pago",
  ship: "Envía el pedido",
  hand_over: "Entrega el pedido",
};

export function deadlineUrgency(dueAt: string | null, now: Date, soonHours: number): DeadlineUrgency {
  if (!dueAt) return "none";
  const remaining = Date.parse(dueAt) - now.getTime();
  if (remaining <= 0) return "overdue";
  return remaining <= soonHours * HOUR_MS ? "due_soon" : "none";
}

/** When an order thread's open response clock stops counting as answered on time. */
export function replyDeadline(clockStartedAt: string) {
  return addMs(clockStartedAt, REPLY_WINDOW_HOURS * HOUR_MS);
}

const deadlineFormats = new Map<string, Intl.DateTimeFormat>();

function deadlineFormat(timeZone: string) {
  let format = deadlineFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone });
    deadlineFormats.set(timeZone, format);
  }
  return format;
}

/**
 * A deadline with its time of day, in the zone the promise was made in. The
 * ship-by promise falls at the hour the order was accepted, not at midnight,
 * so a date alone would read as more time than there is.
 */
export function formatDeadline(value: string, timeZone: string) {
  let format: Intl.DateTimeFormat;
  try {
    format = deadlineFormat(timeZone);
  } catch {
    format = deadlineFormat(FALLBACK_TIME_ZONE);
  }
  return format.format(new Date(value));
}

/** Overdue, then due soon, each earliest deadline first; everything else ties. */
export function compareUrgency(
  left: { urgency: DeadlineUrgency; dueAt: string | null },
  right: { urgency: DeadlineUrgency; dueAt: string | null },
) {
  const rank = URGENCY_RANK[left.urgency] - URGENCY_RANK[right.urgency];
  if (rank !== 0 || left.urgency === "none") return rank;
  return compareDates(left.dueAt, right.dueAt);
}

const URGENCY_RANK: Record<DeadlineUrgency, number> = { overdue: 0, due_soon: 1, none: 2 };

/** Earliest first, and a missing date after any real one. */
export function compareDates(left: string | null, right: string | null) {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return Date.parse(left) - Date.parse(right);
}

// ---------------------------------------------------------------------------
// What the buyer is waiting for, on the seller's order page
// ---------------------------------------------------------------------------

export type SellerOrderGuidance = {
  title: string;
  detail: string;
  /** The promise the seller is held to, when there is one to meet. */
  deadline: { dateTime: string; urgency: DeadlineUrgency; label: string } | null;
};

const CLOSED_DETAIL: Partial<Record<OrderStatus, string>> = {
  rejected: "Rechazaste esta solicitud. No hay nada pendiente.",
  canceled_by_buyer: "El comprador canceló el pedido. No hay nada pendiente.",
  canceled_by_seller: "Cancelaste este pedido. No hay nada pendiente.",
  canceled_by_admin: "Administración canceló este pedido. No hay nada pendiente.",
};

/**
 * What the buyer is waiting for at every status, in the words the order page
 * uses for its buttons. A collected order is never said to be shipped, and
 * nothing here promises the buyer hears about anything: the plaza sends no
 * notifications yet.
 */
export function sellerOrderGuidance(order: SellerOrderFacts, now: Date): SellerOrderGuidance {
  const step = sellerOrderStep(order);
  const pickup = order.fulfillment_method === "pickup";
  const handOverVerb = pickup ? "entregar" : "enviar";
  const markedAs = pickup ? "entregado" : "enviado";

  const promise = (dueAt: string | null): SellerOrderGuidance["deadline"] => {
    if (!dueAt) return null;
    const urgency = deadlineUrgency(dueAt, now, PROMISE_SOON_HOURS);
    const when = formatDeadline(dueAt, order.handling_time_zone);
    return {
      dateTime: dueAt,
      urgency,
      label:
        urgency === "overdue"
          ? `La fecha comprometida para ${handOverVerb} ya pasó: ${when}`
          : `Fecha comprometida para ${handOverVerb}: ${when}`,
    };
  };

  switch (step.kind) {
    case "decide":
      return {
        title: "El comprador espera tu decisión",
        detail: `Acepta la solicitud si puedes cumplirla o recházala si no. No vence sola: sigue pendiente hasta que decidas o el pedido se cancele. Al aceptarla se fija la fecha comprometida para ${handOverVerb}, según el tiempo de preparación.`,
        deadline: null,
      };
    case "confirm_payment":
      return {
        title: "El comprador espera tus indicaciones de pago",
        detail: `El pago se acuerda fuera de la plaza: dile en la conversación cómo pagarte y confirma aquí cuando lo recibas. Hasta que lo confirmes no puedes marcarlo como ${markedAs}.`,
        deadline: promise(step.dueAt),
      };
    case "ship":
      return {
        title: "El comprador espera su envío",
        detail: "Empácalo, mándalo y márcalo como enviado. Si tienes guía o referencia de seguimiento, agrégala para que el comprador la vea en su compra.",
        deadline: promise(step.dueAt),
      };
    case "hand_over":
      return {
        title: "El comprador espera recoger su pedido",
        detail: "Acuerden en la conversación cuándo pasa por él y, cuando se lo des, márcalo como entregado.",
        deadline: promise(step.dueAt),
      };
    case "await_receipt":
      return pickup
        ? {
            title: "El comprador debe confirmar que lo recogió",
            detail: "Ya lo marcaste como entregado. Falta que el comprador confirme desde su compra que lo tiene.",
            deadline: null,
          }
        : {
            title: "El comprador debe confirmar que lo recibió",
            detail: "Ya lo marcaste como enviado. Falta que el comprador confirme desde su compra que le llegó.",
            deadline: null,
          };
    case "await_confirmation":
      return {
        title: "El comprador debe confirmar que todo está bien",
        detail: `Ya confirmó que lo recibió. Si no confirma que todo está bien y no hay una disputa abierta, el pedido se completa automáticamente ${
          step.autoCompleteAt
            ? `a partir del ${formatDeadline(step.autoCompleteAt, order.handling_time_zone)}`
            : `${AUTO_COMPLETE_DAYS} días después de que lo recibió`
        }.`,
        deadline: null,
      };
    case "closed":
      return order.status === "completed"
        ? { title: "Pedido completado", detail: "No hay nada pendiente.", deadline: null }
        : { title: "Pedido cerrado", detail: CLOSED_DETAIL[order.status] ?? "No hay nada pendiente.", deadline: null };
  }
}

// ---------------------------------------------------------------------------
// What the buyer is waiting for, on their purchases
// ---------------------------------------------------------------------------

export type BuyerOrderGuidance = {
  /** A few words for the purchases list. */
  label: string;
  title: string;
  detail: string;
  /** The shop's promise, when it made one. */
  deadline: { dateTime: string; urgency: DeadlineUrgency; label: string } | null;
};

const BUYER_CLOSED_TITLES: Partial<Record<OrderStatus, string>> = {
  completed: "Compra completada",
  rejected: "La tienda rechazó tu solicitud",
  canceled_by_buyer: "Cancelaste este pedido",
  canceled_by_seller: "La tienda canceló este pedido",
  canceled_by_admin: "Administración canceló este pedido",
};

/**
 * The same steps, told to the buyer. Every order has its own conversation, so
 * that is where the buyer is sent when something is late or unclear; nothing
 * here says anybody is notified, because nobody is.
 */
export function buyerOrderGuidance(order: SellerOrderFacts, now: Date): BuyerOrderGuidance {
  const step = sellerOrderStep(order);
  const pickup = order.fulfillment_method === "pickup";
  const handOver = pickup ? "entregarlo" : "enviarlo";

  const promise = (dueAt: string | null): BuyerOrderGuidance["deadline"] => {
    if (!dueAt) return null;
    const urgency = deadlineUrgency(dueAt, now, PROMISE_SOON_HOURS);
    const when = formatDeadline(dueAt, order.handling_time_zone);
    return {
      dateTime: dueAt,
      urgency,
      label:
        urgency === "overdue"
          ? `La fecha que la tienda comprometió para ${handOver} ya pasó: ${when}`
          : `La tienda se comprometió a ${handOver} antes del ${when}`,
    };
  };
  const ifLate = (deadline: BuyerOrderGuidance["deadline"]) =>
    deadline?.urgency === "overdue" ? " Si necesitas saber cómo va, escríbele en la conversación." : "";

  switch (step.kind) {
    case "decide":
      return {
        label: "Esperando a la tienda",
        title: "La tienda está revisando tu solicitud",
        detail: "Puede aceptarla o rechazarla, y no tiene un plazo fijo para decidir. Si tienes dudas, escríbele en la conversación.",
        deadline: null,
      };
    case "confirm_payment": {
      const deadline = promise(step.dueAt);
      return {
        label: "Pago por acordar",
        title: "Acuerda el pago con la tienda",
        detail: `La tienda aceptó tu pedido. El pago se acuerda fuera de la plaza: la tienda te dirá en la conversación cómo pagar y lo confirmará aquí cuando lo reciba.${ifLate(deadline)}`,
        deadline,
      };
    }
    case "ship": {
      const deadline = promise(step.dueAt);
      return {
        label: "Esperando envío",
        title: "La tienda prepara tu envío",
        detail: `Cuando la tienda lo envíe, lo verás marcado aquí, con la guía de seguimiento si la agrega.${ifLate(deadline)}`,
        deadline,
      };
    }
    case "hand_over": {
      const deadline = promise(step.dueAt);
      return {
        label: "Por recoger",
        title: "Tu pedido está listo para acordar la entrega",
        detail: `Acuerda con la tienda en la conversación cuándo pasar por él.${ifLate(deadline)}`,
        deadline,
      };
    }
    case "await_receipt":
      return pickup
        ? {
            label: "Entregado por la tienda",
            title: "La tienda marcó tu pedido como entregado",
            detail: "Cuando lo tengas contigo, confirma aquí que lo recibiste. Si no es así, escríbele en la conversación.",
            deadline: null,
          }
        : {
            label: "En camino",
            title: "Tu pedido va en camino",
            detail: "Cuando llegue, confirma aquí que lo recibiste.",
            deadline: null,
          };
    case "await_confirmation":
      return {
        label: "Por confirmar",
        title: "Confirma que todo está bien",
        detail: `Si no lo confirmas y no hay una disputa abierta, la compra se completa automáticamente ${
          step.autoCompleteAt
            ? `a partir del ${formatDeadline(step.autoCompleteAt, order.handling_time_zone)}`
            : `${AUTO_COMPLETE_DAYS} días después de que lo recibiste`
        }.`,
        deadline: null,
      };
    case "closed":
      return {
        label: formatOrderStatus(order.status, order.fulfillment_method),
        title: BUYER_CLOSED_TITLES[order.status] ?? "Pedido cerrado",
        detail: "No hay nada pendiente.",
        deadline: null,
      };
  }
}

// ---------------------------------------------------------------------------
// The orders page, split by whose move it is
// ---------------------------------------------------------------------------

export type SellerOrderGroupId = "seller" | "buyer" | "closed";

export type SellerOrderEntry<T> = T & { step: SellerOrderStep; urgency: DeadlineUrgency };

export type SellerOrderGroup<T> = { id: SellerOrderGroupId; title: string; orders: SellerOrderEntry<T>[] };

const GROUP_TITLES: Record<SellerOrderGroupId, string> = {
  seller: "Te toca actuar",
  buyer: "Esperando al comprador",
  closed: "Cerrados",
};

const SELLER_STEP_RANK: Partial<Record<SellerOrderStep["kind"], number>> = {
  decide: 0,
  confirm_payment: 1,
  ship: 2,
  hand_over: 2,
};

/**
 * The seller's turn first, with passed and close promises on top and then
 * decisions before payments before hand-overs, oldest first. Orders waiting on
 * the buyer follow, oldest first, and history last, newest first. The seller's
 * group is always there, so the page can say nothing is waiting on them.
 */
export function groupSellerOrders<T extends SellerOrderFacts & { id: number; created_at: string }>(
  orders: T[],
  now: Date,
): SellerOrderGroup<T>[] {
  const entries = orders.map((order) => {
    const step = sellerOrderStep(order);
    return { ...order, step, urgency: deadlineUrgency(step.dueAt, now, PROMISE_SOON_HOURS) };
  });
  const byOwner = (owner: SellerOrderStep["owner"]) => entries.filter((entry) => entry.step.owner === owner);
  const oldestFirst = (left: SellerOrderEntry<T>, right: SellerOrderEntry<T>) => compareDates(left.created_at, right.created_at);

  const seller = byOwner("seller").sort(
    (left, right) =>
      compareUrgency({ urgency: left.urgency, dueAt: left.step.dueAt }, { urgency: right.urgency, dueAt: right.step.dueAt }) ||
      (SELLER_STEP_RANK[left.step.kind] ?? 0) - (SELLER_STEP_RANK[right.step.kind] ?? 0) ||
      compareDates(left.step.dueAt, right.step.dueAt) ||
      oldestFirst(left, right),
  );
  const buyer = byOwner("buyer").sort(oldestFirst);
  const closed = byOwner("nobody").sort((left, right) => oldestFirst(right, left));

  const groups: SellerOrderGroup<T>[] = [{ id: "seller", title: GROUP_TITLES.seller, orders: seller }];
  if (buyer.length) groups.push({ id: "buyer", title: GROUP_TITLES.buyer, orders: buyer });
  if (closed.length) groups.push({ id: "closed", title: GROUP_TITLES.closed, orders: closed });
  return groups;
}
