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

/**
 * How a shop's measured history came back.
 *
 * A shop nobody has evaluated yet and a read that failed are different facts,
 * and a buyer deserves to be told which one they are looking at: `pending`
 * means there is nothing to report, `unavailable` means we could not report.
 */
export type TrustMetricsResult =
  | { status: "ready"; metrics: PublicTrustMetrics }
  | { status: "pending" }
  | { status: "unavailable" };

export const NO_DATA_LABEL = "Sin datos aún";
export const UNAVAILABLE_LABEL = "No disponible";

/** The 90-day window every rate below is measured over, as the evaluator reads it. */
export const METRIC_WINDOW_DAYS = 90;
const WINDOW_CONTEXT = `Últimos ${METRIC_WINDOW_DAYS} días`;

/**
 * What a single signal is.
 *
 * - `measured`: a result the shop earned, whether flattering or not.
 * - `zero`: a real zero over a valid denominator. Genuine poor performance
 *   lives here and is never hidden.
 * - `empty`: nothing eligible has happened yet, so there is no rate to state.
 */
export type TrustSignalState = "measured" | "zero" | "empty";

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

export type PublicTrustSignal = {
  key: string;
  label: string;
  explanation: string;
  value: string;
  state: TrustSignalState;
  /** Sample size or time window, when the metric has one worth naming. */
  context: string | null;
};

type SignalReading = Pick<PublicTrustSignal, "value" | "state" | "context">;

type PublicTrustMarker = {
  key: string;
  label: string;
  explanation: string;
  read: (metrics: PublicTrustMetrics | null) => SignalReading;
};

/**
 * A rate reading.
 *
 * `null` is not zero: the evaluator divides by `nullif(count, 0)`, so a null
 * means no eligible observation existed and there is no percentage to state.
 * A real zero over a real denominator is kept, because it is the truth.
 */
function rate(
  value: number | null,
  emptyLabel: string,
  context: string | null = WINDOW_CONTEXT,
): SignalReading {
  if (value === null) return { value: emptyLabel, state: "empty", context: null };
  if (value === 0) return { value: "0%", state: "zero", context };
  return { value: formatTrustPercentage(value), state: "measured", context };
}

/** Every dimension the trust evaluator reads, in the order the tier weighs them. */
export const PUBLIC_TRUST_MARKERS: PublicTrustMarker[] = [
  {
    key: "response_rate",
    label: "Respuesta",
    explanation: "Cuántas conversaciones de compradores contesta esta tienda.",
    // No eligible conversation means no response rate at all — not zero.
    read: (metrics) => rate(metrics?.responseRate ?? null, "Sin historial de respuesta"),
  },
  {
    key: "reply_time",
    label: "Tiempo de respuesta",
    explanation: "Cuánto tarda en contestar el primer mensaje de un pedido.",
    read: (metrics) => {
      const minutes = metrics?.averageReplyTimeMinutes ?? null;
      if (minutes === null) {
        return { value: "Sin historial de respuesta", state: "empty", context: null };
      }
      return { value: formatReplyTime(minutes), state: "measured", context: WINDOW_CONTEXT };
    },
  },
  {
    key: "description_accuracy",
    label: "Precisión",
    explanation: "Qué tan seguido lo recibido coincide con lo publicado, según quienes compraron.",
    read: (metrics) => rate(metrics?.descriptionAccuracy ?? null, "Sin reseñas que lo midan"),
  },
  {
    key: "on_time_shipping",
    label: "Envíos puntuales",
    explanation: "Pedidos enviados dentro del plazo de manejo que la tienda ofreció.",
    read: (metrics) => rate(metrics?.onTimeShippingRate ?? null, "Sin envíos evaluados"),
  },
  {
    key: "order_completion",
    label: "Pedidos completados",
    explanation: "Solicitudes aceptadas que terminaron en una entrega confirmada.",
    read: (metrics) => rate(metrics?.orderCompletionRate ?? null, "Sin pedidos evaluados"),
  },
  {
    key: "dispute_rate",
    label: "Disputas",
    explanation: "Pedidos que terminaron en una disputa. Más bajo es mejor.",
    // A clean record is an achievement, but only a shop with pedidos to
    // measure can have earned it: with no eligible order there is nothing
    // to call clean.
    read: (metrics) => {
      const value = metrics?.disputeRate ?? null;
      if (value === null) return { value: "Sin pedidos evaluados", state: "empty", context: null };
      if (value === 0) return { value: "Sin disputas", state: "measured", context: WINDOW_CONTEXT };
      return { value: formatTrustPercentage(value), state: "measured", context: WINDOW_CONTEXT };
    },
  },
  {
    key: "total_orders",
    label: "Pedidos",
    explanation: "Cuánta experiencia acumula esta tienda dentro de la plaza.",
    read: (metrics) => {
      const total = metrics?.totalOrders ?? null;
      if (total === null) return { value: NO_DATA_LABEL, state: "empty", context: null };
      if (total === 0) return { value: "Sin ventas registradas", state: "empty", context: null };
      return { value: formatOrderCount(total), state: "measured", context: "Desde que abrió" };
    },
  },
  {
    key: "rating",
    label: "Calificación",
    explanation: "Promedio de las reseñas que dejan las personas compradoras.",
    read: (metrics) => {
      const reviewCount = metrics?.reviewCount ?? null;
      const average = metrics?.averageRating ?? null;
      // A shop with no reviews has no average — not a zero-star one.
      if (!reviewCount || average === null) {
        return { value: "Aún sin reseñas", state: "empty", context: null };
      }
      return {
        value: formatRating(average, reviewCount),
        state: "measured",
        context: reviewCount === 1 ? "1 reseña" : `${reviewCount} reseñas`,
      };
    },
  },
  {
    key: "review_count",
    label: "Reseñas",
    explanation: "Cuántas personas ya calificaron una compra en esta tienda.",
    read: (metrics) => {
      const reviewCount = metrics?.reviewCount ?? null;
      if (reviewCount === null) return { value: NO_DATA_LABEL, state: "empty", context: null };
      if (reviewCount === 0) return { value: "Aún sin reseñas", state: "empty", context: null };
      return { value: String(reviewCount), state: "measured", context: null };
    },
  },
  {
    key: "last_active",
    label: "Actividad",
    explanation:
      "Activo recientemente. Medimos si la persona vendedora sigue presente en la plaza: entra a su cuenta y atiende sus pedidos.",
    read: (metrics) => {
      const daysAgo = metrics?.sellerActiveDaysAgo ?? null;
      if (daysAgo === null) return { value: NO_DATA_LABEL, state: "empty", context: null };
      // Presence is only worth marking while it is current.
      return {
        value: formatLastActive(daysAgo),
        state: isRecentlyActive(daysAgo) ? "measured" : "empty",
        context: null,
      };
    },
  },
];

export function readTrustSignals(metrics: PublicTrustMetrics | null): PublicTrustSignal[] {
  return PUBLIC_TRUST_MARKERS.map((marker) => ({
    key: marker.key,
    label: marker.label,
    explanation: marker.explanation,
    ...marker.read(metrics),
  }));
}

/** The metrics themselves, or null when there are none to read. */
export function trustMetricsOf(result: TrustMetricsResult): PublicTrustMetrics | null {
  return result.status === "ready" ? result.metrics : null;
}
