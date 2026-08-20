import { z } from "zod";

const signalSchema = z.enum(["Excellent", "Good", "Average", "Needs improvement", "No data", "New"]);
const markerSchema = z.object({
  primary_text: z.string(),
  tooltip: z.string(),
  signal: signalSchema,
}).strict();

const buyerTrustOutputSchema = z.object({
  member_since: z.object({ primary_text: z.string(), tooltip: z.string() }).strict(),
  verification_level: z.object({
    primary_text: z.string(),
    badge_label: z.string(),
    tooltip: z.string(),
  }).strict(),
  buyer_trust_tier: z.enum(["New", "Reliable", "Top Buyer"]),
  markers: z.object({
    total_completed_purchases: markerSchema,
    buyer_completion_rate: markerSchema,
    claim_rate: markerSchema,
    cancellation_rate: markerSchema,
    payment_reliability: markerSchema,
    average_time_to_close: markerSchema,
    fast_closer_rate: markerSchema,
    response_rate: markerSchema,
    review_rate: markerSchema,
    recent_activity: markerSchema,
  }).strict(),
  summary: z.string(),
  reasons: z.array(z.string()),
  next_tier_requirements: z.array(z.string()),
}).strict();

export type BuyerTrustOutput = z.infer<typeof buyerTrustOutputSchema>;
export type BuyerTrustSignal = z.infer<typeof signalSchema>;
export type BuyerTrustTier = BuyerTrustOutput["buyer_trust_tier"];

const tierLabels: Record<BuyerTrustTier, string> = {
  New: "Nuevo",
  Reliable: "Confiable",
  "Top Buyer": "Comprador destacado",
};

const signalLabels: Record<BuyerTrustSignal, string> = {
  Excellent: "Excelente",
  Good: "Bueno",
  Average: "Promedio",
  "Needs improvement": "Necesita mejorar",
  "No data": "Sin datos",
  New: "Nuevo",
};

export function parseBuyerTrustOutput(value: unknown): BuyerTrustOutput | null {
  const parsed = buyerTrustOutputSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function formatBuyerTier(tier: BuyerTrustTier) {
  return tierLabels[tier];
}

export function formatBuyerSignal(signal: BuyerTrustSignal) {
  return signalLabels[signal];
}

function positive(signal: BuyerTrustSignal) {
  return signal === "Excellent" || signal === "Good";
}

export function getBuyerStanding(output: BuyerTrustOutput) {
  const suffix = positive(output.markers.fast_closer_rate.signal)
    ? "Cierra rápido"
    : positive(output.markers.payment_reliability.signal)
      ? "Pago confiable"
      : positive(output.markers.buyer_completion_rate.signal)
        ? "Completa compras"
        : positive(output.markers.response_rate.signal)
          ? "Responde a tiempo"
          : null;
  const tier = formatBuyerTier(output.buyer_trust_tier);
  return suffix ? `${tier} · ${suffix}` : tier;
}
