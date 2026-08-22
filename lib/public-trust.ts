export type PublicTrustMetrics = {
  averageReplyTimeMinutes: number | null;
  responseRate: number | null;
  descriptionAccuracy: number | null;
  onTimeShippingRate: number | null;
  orderCompletionRate: number | null;
  disputeRate: number | null;
  totalOrders: number | null;
  averageRating: number | null;
  reviewCount: number | null;
  lastActiveDaysAgo: number | null;
  /** How long since the seller themselves used the plaza. */
  sellerActiveDaysAgo: number | null;
  evaluatedAt: string | null;
};

export const NO_DATA_LABEL = "Sin datos aún";

function round(value: number) {
  return Math.round(value * 10) / 10;
}

/** A clean record reads as a fact, not as a rate nobody has tested. */
export function formatDisputeRate(rate: number | null) {
  if (!rate) return "Sin disputas";
  return formatTrustPercentage(rate);
}

export function formatTrustPercentage(value: number | null) {
  if (value === null) return NO_DATA_LABEL;
  return `${round(value)}%`;
}

export function formatReplyTime(minutes: number | null) {
  if (minutes === null) return NO_DATA_LABEL;
  if (minutes < 60) return `${round(minutes)} min`;
  return `${round(minutes / 60)} h`;
}

export function formatRating(average: number | null, reviewCount: number | null) {
  // The review count has a badge of its own, so the rating stays a bare average.
  if (average === null || !reviewCount) return NO_DATA_LABEL;
  return average.toFixed(1);
}

/** A seller counts as active when they have used the plaza within this window. */
export const ACTIVE_WITHIN_DAYS = 3;

export function isRecentlyActive(daysAgo: number | null) {
  return daysAgo !== null && daysAgo <= ACTIVE_WITHIN_DAYS;
}

export function formatLastActive(daysAgo: number | null) {
  if (daysAgo === null) return NO_DATA_LABEL;
  if (isRecentlyActive(daysAgo)) return "Activo recientemente";
  return daysAgo === 1 ? "Hace 1 día" : `Hace ${daysAgo} días`;
}

export function formatOrderCount(total: number | null) {
  if (total === null) return NO_DATA_LABEL;
  return String(total);
}

export type PublicTrustMarker = {
  key: string;
  label: string;
  explanation: string;
  value: (metrics: PublicTrustMetrics | null) => string;
  /**
   * Whether the shop has actually earned this signal. A rate of zero is a real
   * measurement, but a count of zero means nothing has happened yet.
   */
  measured: (metrics: PublicTrustMetrics | null) => boolean;
};

function hasValue(value: string) {
  return value !== NO_DATA_LABEL;
}

/** Every dimension the trust evaluator reads, in the order the tier weighs them. */
export const PUBLIC_TRUST_MARKERS: PublicTrustMarker[] = [
  {
    key: "response_rate",
    label: "Respuesta",
    explanation: "Cuántas conversaciones de compradores contesta esta tienda.",
    value: (metrics) => formatTrustPercentage(metrics?.responseRate ?? null),
    measured: (metrics) => hasValue(formatTrustPercentage(metrics?.responseRate ?? null)),
  },
  {
    key: "reply_time",
    label: "Tiempo de respuesta",
    explanation: "Cuánto tarda en contestar el primer mensaje de un pedido.",
    value: (metrics) => formatReplyTime(metrics?.averageReplyTimeMinutes ?? null),
    measured: (metrics) => hasValue(formatReplyTime(metrics?.averageReplyTimeMinutes ?? null)),
  },
  {
    key: "description_accuracy",
    label: "Precisión",
    explanation: "Qué tan seguido lo recibido coincide con lo publicado, según quienes compraron.",
    value: (metrics) => formatTrustPercentage(metrics?.descriptionAccuracy ?? null),
    measured: (metrics) => hasValue(formatTrustPercentage(metrics?.descriptionAccuracy ?? null)),
  },
  {
    key: "on_time_shipping",
    label: "Envíos puntuales",
    explanation: "Pedidos enviados dentro del plazo de manejo que la tienda ofreció.",
    value: (metrics) => formatTrustPercentage(metrics?.onTimeShippingRate ?? null),
    measured: (metrics) => hasValue(formatTrustPercentage(metrics?.onTimeShippingRate ?? null)),
  },
  {
    key: "order_completion",
    label: "Pedidos completados",
    explanation: "Solicitudes aceptadas que terminaron en una entrega confirmada.",
    value: (metrics) => formatTrustPercentage(metrics?.orderCompletionRate ?? null),
    measured: (metrics) => hasValue(formatTrustPercentage(metrics?.orderCompletionRate ?? null)),
  },
  {
    key: "dispute_rate",
    label: "Disputas",
    explanation: "Pedidos que terminaron en una disputa. Más bajo es mejor.",
    // No disputes is the achievement, so a shop with none earns the badge whether
    // or not it has been evaluated yet.
    value: (metrics) => formatDisputeRate(metrics?.disputeRate ?? null),
    measured: () => true,
  },
  {
    key: "total_orders",
    label: "Pedidos",
    explanation: "Cuánta experiencia acumula esta tienda dentro de la plaza.",
    value: (metrics) => formatOrderCount(metrics?.totalOrders ?? null),
    measured: (metrics) => Boolean(metrics?.totalOrders),
  },
  {
    key: "rating",
    label: "Calificación",
    explanation: "Promedio de las reseñas que dejan las personas compradoras.",
    value: (metrics) => formatRating(metrics?.averageRating ?? null, metrics?.reviewCount ?? null),
    measured: (metrics) => hasValue(formatRating(metrics?.averageRating ?? null, metrics?.reviewCount ?? null)),
  },
  {
    key: "review_count",
    label: "Reseñas",
    explanation: "Cuántas personas ya calificaron una compra en esta tienda.",
    value: (metrics) =>
      metrics?.reviewCount == null ? NO_DATA_LABEL : String(metrics.reviewCount),
    measured: (metrics) => Boolean(metrics?.reviewCount),
  },
  {
    key: "last_active",
    label: "Actividad",
    explanation:
      "Activo recientemente. Medimos si la persona vendedora sigue presente en la plaza: entra a su cuenta y atiende sus pedidos.",
    value: (metrics) => formatLastActive(metrics?.sellerActiveDaysAgo ?? null),
    // Presence is only worth marking while it is current.
    measured: (metrics) => isRecentlyActive(metrics?.sellerActiveDaysAgo ?? null),
  },
];
