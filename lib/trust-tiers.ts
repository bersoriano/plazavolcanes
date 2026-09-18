export type TrustTier = "standard" | "reliable" | "top_rated";

export type TrustMetrics = {
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
  openDisputeCount: number;
};

export type TrustDashboard = {
  tier: TrustTier;
  listingLimit: number;
  publishedCount: number;
  evaluatedAt: string | null;
  metrics: TrustMetrics | null;
  reasons: string[];
  nextRequirements: string[];
  summary: string;
};

/**
 * The operational tier, in the seller's own words.
 *
 * This level is what sets a shop's publication limit. It is measured, it is
 * not the Premium distinction, and outside the seller's panel only an earned
 * tier is ever shown — see `publicReputationTier` in `lib/seller-standing`.
 */
const markers = {
  standard: {
    label: "Estándar",
    listingLimit: 15,
    tooltip: "Nivel inicial de operación: hasta 15 publicaciones mientras la tienda reúne evidencia de servicio, cumplimiento y satisfacción. No se muestra a quienes compran.",
  },
  reliable: {
    label: "Confiable",
    listingLimit: 40,
    tooltip: "Esta tienda cumple requisitos consistentes de respuesta, envíos, pedidos completados y baja tasa de disputas. Sube el límite a 40 publicaciones.",
  },
  top_rated: {
    label: "Mejor valorada",
    listingLimit: 100,
    tooltip: "Esta tienda mantiene los estándares más altos de servicio, cumplimiento, actividad y satisfacción en Plaza Volcanes. Sube el límite a 100 publicaciones.",
  },
} satisfies Record<TrustTier, { label: string; listingLimit: number; tooltip: string }>;

export function getTrustTierMarker(tier: TrustTier) {
  return markers[tier];
}
