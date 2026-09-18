import { readTrustSignals, type TrustMetricsResult } from "@/lib/public-trust";
import { generateMemberSinceMarker } from "@/lib/trust-markers";
import type { TrustTier } from "@/lib/trust-tiers";

/**
 * One meaning per concept, shared by every surface that shows a seller.
 *
 * Premium is a distinction Plaza Volcanes grants. Reputation is what the
 * plaza has observed. New-seller context is neither an award nor a warning.
 * A shop can hold all three at once without any of them contradicting the
 * others, which is exactly why the copy for each lives here rather than being
 * rewritten page by page.
 */

export const PREMIUM_LABEL = "Premium";
export const PREMIUM_ACCESSIBLE_NAME = "Tienda Premium";

/** The one line that always travels with the badge. */
export const PREMIUM_SUMMARY = "Distinción otorgada por Plaza Volcanes.";

/**
 * What the distinction is, and — just as important — what it is not.
 *
 * Only the presentation benefit is named, because it is the only benefit the
 * approved policy defines. Ranking, placement, support and fees are outside
 * the programme, so they are not promised here.
 */
export const PREMIUM_DETAILS = [
  "Plaza Volcanes otorga esta distinción a la tienda y la presenta de forma destacada en su página, en sus productos y en el catálogo.",
  "No mide ventas, no revisa la identidad de quien vende y no responde por la entrega de un pedido. El historial de ventas se calcula aparte, con pedidos y reseñas reales, y nadie puede editarlo.",
];

export const REPUTATION_HEADING = "Historial de ventas";

/**
 * When a seller may be called new.
 *
 * Zero sales does not prove a recent arrival — a shop can be quiet for a
 * year. The only defined rule is antiquity, the same one the membership
 * marker already uses, so this note follows it and nothing else.
 */
export const NEW_SELLER_DAYS = 30;
export const NEW_SELLER_LABEL = "Nuevo en Plaza Volcanes";

export function newSellerNote(joinedOn: string | null | undefined, currentDate?: string) {
  if (!joinedOn) return null;
  const marker = generateMemberSinceMarker({
    join_date: joinedOn,
    ...(currentDate ? { current_date: currentDate } : {}),
  });
  if (marker.days_active < 0 || marker.days_active >= NEW_SELLER_DAYS) return null;
  return NEW_SELLER_LABEL;
}

/**
 * The tier a buyer is shown.
 *
 * `standard` is the tier every shop starts in, so publishing it says nothing
 * a buyer can decide on and reads as a rank beside the Premium badge. It
 * keeps its operational meaning — it is what sets the 15-listing limit — and
 * the seller still sees it in their own panel. Only an earned tier is public.
 */
export function publicReputationTier(tier: TrustTier): Exclude<TrustTier, "standard"> | null {
  return tier === "standard" ? null : tier;
}

export const REPUTATION_TIER_LABELS: Record<Exclude<TrustTier, "standard">, string> = {
  reliable: "Confiable",
  top_rated: "Mejor valorada",
};

export const REPUTATION_TIER_EXPLANATIONS: Record<Exclude<TrustTier, "standard">, string> = {
  reliable:
    "Reputación medida: esta tienda cumple requisitos constantes de respuesta, envíos, pedidos completados y disputas.",
  top_rated:
    "Reputación medida: esta tienda sostiene los estándares más altos de servicio, cumplimiento, actividad y satisfacción.",
};

export type SellingHistoryState = "unavailable" | "empty" | "present";

export type SellingHistorySummary = {
  state: SellingHistoryState;
  /** The short phrase that completes "Historial de ventas: …". */
  headline: string;
  /** One neutral sentence of context, or null when the headline says it all. */
  detail: string | null;
};

function plural(count: number, one: string, many: string) {
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

export function summarizeSellingHistory(result: TrustMetricsResult): SellingHistorySummary {
  if (result.status === "unavailable") {
    return {
      state: "unavailable",
      headline: "no disponible por ahora",
      detail:
        "No pudimos leer las métricas de esta tienda. Vuelve a cargar la página para intentarlo de nuevo.",
    };
  }

  if (result.status === "pending") {
    return {
      state: "empty",
      headline: "está construyendo su historial",
      detail: "Todavía no hay pedidos ni reseñas medidos para esta tienda.",
    };
  }

  const { metrics } = result;
  const orders = metrics.totalOrders ?? 0;
  const reviews = metrics.reviewCount ?? 0;

  if (!orders && !reviews) {
    return {
      state: "empty",
      headline: "aún sin reseñas",
      detail: "Esta tienda todavía no registra pedidos completados.",
    };
  }

  const parts: string[] = [];
  if (orders) parts.push(plural(orders, "pedido completado", "pedidos completados"));
  if (reviews && metrics.averageRating !== null) {
    parts.push(`${metrics.averageRating.toFixed(1)} de 5 en ${plural(reviews, "reseña", "reseñas")}`);
  } else if (reviews) {
    parts.push(plural(reviews, "reseña", "reseñas"));
  } else {
    parts.push("aún sin reseñas");
  }

  return { state: "present", headline: parts.join(" · "), detail: null };
}

/** Whether anything at all has been observed, and so whether details are worth opening. */
export function hasMeasuredHistory(result: TrustMetricsResult) {
  if (result.status !== "ready") return false;
  return readTrustSignals(result.metrics).some((signal) => signal.state !== "empty");
}
