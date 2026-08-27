import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BuyerTrustCard } from "@/components/orders/buyer-trust-card";
import type { BuyerTrustOutput } from "@/lib/buyer-trust";

const marker = (primary_text: string, signal: BuyerTrustOutput["markers"]["claim_rate"]["signal"]) => ({
  primary_text,
  tooltip: `Qué significa ${primary_text}.`,
  signal,
});

const trust: BuyerTrustOutput = {
  member_since: { primary_text: "Miembro desde enero de 2026", tooltip: "Antigüedad de la cuenta." },
  verification_level: { primary_text: "Comprador verificado", badge_label: "Verificado", tooltip: "Identidad revisada." },
  buyer_trust_tier: "Reliable",
  markers: {
    total_completed_purchases: marker("12 compras completadas", "Good"),
    buyer_completion_rate: marker("96% de compras completadas", "Good"),
    claim_rate: marker("1% de reclamos", "Excellent"),
    cancellation_rate: marker("2% de cancelaciones", "Excellent"),
    payment_reliability: marker("98% de pagos confiables", "Excellent"),
    average_time_to_close: marker("30 h para pagar", "Good"),
    fast_closer_rate: marker("85% paga en 48 h", "Excellent"),
    response_rate: marker("92% de respuesta", "Excellent"),
    review_rate: marker("60% deja reseña", "Good"),
    recent_activity: marker("Activo hace 2 días", "Excellent"),
  },
  summary: "Comprador confiable con buen historial.",
  reasons: ["12 compras completadas con 96% de finalización."],
  next_tier_requirements: ["Completa 25 compras; valor actual: 12."],
};

afterEach(cleanup);

describe("BuyerTrustCard", () => {
  it("shows short standing and identity markers", () => {
    render(<BuyerTrustCard trust={trust} />);
    expect(screen.getByRole("heading", { name: "Confiable · Cierra rápido" })).toBeInTheDocument();
    expect(screen.getByText("Miembro desde enero de 2026")).toBeInTheDocument();
  });

  it("renders ten compact behavior markers and next-tier guidance", () => {
    render(<BuyerTrustCard trust={trust} />);
    const group = screen.getByRole("group", { name: "Señales de confianza del comprador" });
    expect(within(group).getAllByRole("button", { name: /Más información/ })).toHaveLength(10);
    expect(screen.getByText("Compras completadas")).toBeInTheDocument();
    expect(screen.getByText("Pagos confiables")).toBeInTheDocument();
    expect(screen.getByText("Actividad reciente")).toBeInTheDocument();
    expect(screen.getByText("Cómo llegar al siguiente nivel")).toBeInTheDocument();
    expect(screen.getByText(/Completa 25 compras; valor actual: 12\./)).toBeInTheDocument();
  });
});
