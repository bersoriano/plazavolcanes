import { describe, expect, it } from "vitest";

import {
  formatBuyerSignal,
  formatBuyerTier,
  getBuyerStanding,
  parseBuyerTrustOutput,
  type BuyerTrustOutput,
} from "@/lib/buyer-trust";

const marker = (signal: BuyerTrustOutput["markers"]["claim_rate"]["signal"]) => ({
  primary_text: "Dato",
  tooltip: "Explicación breve.",
  signal,
});

const output: BuyerTrustOutput = {
  member_since: { primary_text: "Miembro desde enero de 2026", tooltip: "Antigüedad de la cuenta." },
  verification_level: { primary_text: "Comprador verificado", badge_label: "Verificado", tooltip: "Identidad revisada." },
  buyer_trust_tier: "Reliable",
  markers: {
    total_completed_purchases: marker("Good"),
    buyer_completion_rate: marker("Good"),
    claim_rate: marker("Excellent"),
    cancellation_rate: marker("Excellent"),
    payment_reliability: marker("Good"),
    average_time_to_close: marker("Good"),
    fast_closer_rate: marker("Good"),
    response_rate: marker("Good"),
    review_rate: marker("Average"),
    recent_activity: marker("Good"),
  },
  summary: "Comprador confiable.",
  reasons: ["Buen historial."],
  next_tier_requirements: ["Completa 25 compras."],
};

describe("buyer trust formatting", () => {
  it.each([
    ["New", "Nuevo"],
    ["Reliable", "Confiable"],
    ["Top Buyer", "Comprador destacado"],
  ] as const)("maps tier %s to Spanish", (tier, label) => {
    expect(formatBuyerTier(tier)).toBe(label);
  });

  it.each([
    ["Excellent", "Excelente"],
    ["Good", "Bueno"],
    ["Average", "Promedio"],
    ["Needs improvement", "Necesita mejorar"],
    ["No data", "Sin datos"],
    ["New", "Nuevo"],
  ] as const)("maps signal %s to Spanish", (signal, label) => {
    expect(formatBuyerSignal(signal)).toBe(label);
  });

  it("prioritizes fast closing in short standing", () => {
    expect(getBuyerStanding(output)).toBe("Confiable · Cierra rápido");
  });

  it("falls through payment, completion, then response evidence", () => {
    const withoutFast = { ...output, markers: { ...output.markers, fast_closer_rate: marker("Average") } };
    expect(getBuyerStanding(withoutFast)).toBe("Confiable · Pago confiable");
    const withoutPayment = { ...withoutFast, markers: { ...withoutFast.markers, payment_reliability: marker("Average") } };
    expect(getBuyerStanding(withoutPayment)).toBe("Confiable · Completa compras");
    const withoutCompletion = { ...withoutPayment, markers: { ...withoutPayment.markers, buyer_completion_rate: marker("Average") } };
    expect(getBuyerStanding(withoutCompletion)).toBe("Confiable · Responde a tiempo");
  });

  it("omits suffix without positive priority evidence", () => {
    const noPositive = {
      ...output,
      markers: {
        ...output.markers,
        fast_closer_rate: marker("No data"),
        payment_reliability: marker("Needs improvement"),
        buyer_completion_rate: marker("Average"),
        response_rate: marker("New"),
      },
    };
    expect(getBuyerStanding(noPositive)).toBe("Confiable");
  });

  it("parses exact evaluator output and rejects extra fields", () => {
    expect(parseBuyerTrustOutput(output)).toEqual(output);
    expect(parseBuyerTrustOutput({ ...output, unsafe_html: "<script>" })).toBeNull();
  });
});
