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
  evaluatedAt: string | null;
};

export const NO_DATA_LABEL = "Sin datos aún";

function round(value: number) {
  return Math.round(value * 10) / 10;
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
  if (average === null || !reviewCount) return NO_DATA_LABEL;
  const reviews = reviewCount === 1 ? "1 reseña" : `${reviewCount} reseñas`;
  return `${average.toFixed(1)} · ${reviews}`;
}

export function formatLastActive(daysAgo: number | null) {
  if (daysAgo === null) return NO_DATA_LABEL;
  if (daysAgo <= 0) return "Hoy";
  return daysAgo === 1 ? "Hace 1 día" : `Hace ${daysAgo} días`;
}

export function formatOrderCount(total: number | null) {
  if (total === null) return NO_DATA_LABEL;
  return total === 1 ? "1 pedido" : `${total} pedidos`;
}

export type PublicTrustMarker = {
  key: string;
  label: string;
  explanation: string;
  value: (metrics: PublicTrustMetrics | null) => string;
};

/** Every dimension the trust evaluator reads, in the order the tier weighs them. */
export const PUBLIC_TRUST_MARKERS: PublicTrustMarker[] = [
  {
    key: "response_rate",
    label: "Respuesta",
    explanation: "Cuántas conversaciones de compradores contesta esta tienda.",
    value: (metrics) => formatTrustPercentage(metrics?.responseRate ?? null),
  },
  {
    key: "reply_time",
    label: "Tiempo de respuesta",
    explanation: "Cuánto tarda en contestar el primer mensaje de un pedido.",
    value: (metrics) => formatReplyTime(metrics?.averageReplyTimeMinutes ?? null),
  },
  {
    key: "description_accuracy",
    label: "Precisión",
    explanation: "Qué tan seguido lo recibido coincide con lo publicado, según quienes compraron.",
    value: (metrics) => formatTrustPercentage(metrics?.descriptionAccuracy ?? null),
  },
  {
    key: "on_time_shipping",
    label: "Envíos puntuales",
    explanation: "Pedidos enviados dentro del plazo de manejo que la tienda ofreció.",
    value: (metrics) => formatTrustPercentage(metrics?.onTimeShippingRate ?? null),
  },
  {
    key: "order_completion",
    label: "Pedidos completados",
    explanation: "Solicitudes aceptadas que terminaron en una entrega confirmada.",
    value: (metrics) => formatTrustPercentage(metrics?.orderCompletionRate ?? null),
  },
  {
    key: "dispute_rate",
    label: "Disputas",
    explanation: "Pedidos que terminaron en una disputa. Más bajo es mejor.",
    value: (metrics) => formatTrustPercentage(metrics?.disputeRate ?? null),
  },
  {
    key: "total_orders",
    label: "Pedidos",
    explanation: "Cuánta experiencia acumula esta tienda dentro de la plaza.",
    value: (metrics) => formatOrderCount(metrics?.totalOrders ?? null),
  },
  {
    key: "rating",
    label: "Calificación",
    explanation: "Promedio de las reseñas que dejan las personas compradoras.",
    value: (metrics) => formatRating(metrics?.averageRating ?? null, metrics?.reviewCount ?? null),
  },
  {
    key: "review_count",
    label: "Reseñas",
    explanation: "Cuántas personas ya calificaron una compra en esta tienda.",
    value: (metrics) =>
      metrics?.reviewCount == null ? NO_DATA_LABEL : String(metrics.reviewCount),
  },
  {
    key: "last_active",
    label: "Actividad",
    explanation: "Cuándo atendió esta tienda un pedido o mensaje por última vez.",
    value: (metrics) => formatLastActive(metrics?.lastActiveDaysAgo ?? null),
  },
];
