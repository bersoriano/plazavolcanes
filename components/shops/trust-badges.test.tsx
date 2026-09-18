import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TrustBadges } from "@/components/shops/trust-badges";
import { PUBLIC_TRUST_MARKERS, type PublicTrustMetrics } from "@/lib/public-trust";

afterEach(cleanup);

const fullMetrics: PublicTrustMetrics = {
  averageReplyTimeMinutes: 42,
  responseRate: 98,
  descriptionAccuracy: 95,
  onTimeShippingRate: 100,
  orderCompletionRate: 97,
  disputeRate: 2,
  totalOrders: 34,
  averageRating: 4.8,
  reviewCount: 12,
  lastActiveDaysAgo: 1,
  sellerActiveDaysAgo: null,
  evaluatedAt: "2026-08-20T00:00:00.000Z",
};

const ready = { status: "ready", metrics: fullMetrics } as const;
const profile = { joinedOn: "2026-02-01" };

describe("TrustBadges", () => {
  it("renders a badge for every trust signal, metrics plus membership", () => {
    render(<TrustBadges metrics={ready} profile={profile} />);

    const list = screen.getByRole("list", { name: "Marcadores de confianza" });

    expect(within(list).getAllByRole("listitem")).toHaveLength(
      PUBLIC_TRUST_MARKERS.length + 1,
    );
  });

  it("shows no verification badge, because no verification process exists", () => {
    render(<TrustBadges metrics={ready} profile={profile} />);

    const list = screen.getByRole("list", { name: "Marcadores de confianza" });

    expect(within(list).queryByTestId("trust-badge-verification")).toBeNull();
    expect(list.textContent).not.toMatch(/verificad/i);
  });

  it("marks a measured signal as active and shows its value", () => {
    render(<TrustBadges metrics={ready} profile={profile} />);

    const badge = screen.getByTestId("trust-badge-response_rate");

    expect(badge).toHaveAttribute("data-state", "measured");
    expect(badge).toHaveTextContent("Respuesta");
    expect(badge).toHaveTextContent("98%");
    // The fill is the brand colour, which turns gold inside a premium shop:
    // white ink would all but vanish there, so the ink follows the fill.
    expect(badge).toHaveClass("text-on-brand");
    expect(badge).not.toHaveClass("text-white");
  });

  it("names the window a rate was measured over", () => {
    render(<TrustBadges metrics={ready} profile={profile} />);

    expect(screen.getByTestId("trust-badge-response_rate")).toHaveTextContent("Últimos 90 días");
  });

  it("greys out a signal with nothing measured yet", () => {
    render(<TrustBadges metrics={{ status: "pending" }} profile={profile} />);

    for (const marker of PUBLIC_TRUST_MARKERS) {
      expect(screen.getByTestId(`trust-badge-${marker.key}`)).toHaveAttribute(
        "data-state",
        "empty",
      );
    }
  });

  it("tells a shop with no eligible order apart from one with a clean record", () => {
    const { rerender } = render(<TrustBadges metrics={{ status: "pending" }} profile={profile} />);

    const untested = screen.getByTestId("trust-badge-dispute_rate");
    expect(untested).toHaveAttribute("data-state", "empty");
    expect(untested).toHaveTextContent("Sin pedidos evaluados");

    rerender(
      <TrustBadges
        metrics={{ status: "ready", metrics: { ...fullMetrics, disputeRate: 0 } }}
        profile={profile}
      />,
    );

    const clean = screen.getByTestId("trust-badge-dispute_rate");
    expect(clean).toHaveAttribute("data-state", "measured");
    expect(clean).toHaveTextContent("Sin disputas");
  });

  it("renders a retry state, not an empty history, when the read failed", () => {
    render(<TrustBadges metrics={{ status: "unavailable" }} profile={profile} />);

    expect(screen.getByTestId("trust-badges-unavailable")).toHaveTextContent(/Vuelve a cargar/);
    expect(screen.queryByRole("list", { name: "Marcadores de confianza" })).toBeNull();
  });

  it("keeps membership active when the profile exists", () => {
    render(<TrustBadges metrics={{ status: "pending" }} profile={profile} />);

    expect(screen.getByTestId("trust-badge-membership")).toHaveAttribute(
      "data-state",
      "measured",
    );
  });

  it("greys out membership when no profile exists", () => {
    render(<TrustBadges metrics={ready} profile={null} />);

    expect(screen.getByTestId("trust-badge-membership")).toHaveAttribute("data-state", "empty");
  });

  it("explains each signal for hover and for screen readers", () => {
    render(<TrustBadges metrics={ready} profile={profile} />);

    const badge = screen.getByTestId("trust-badge-dispute_rate");
    const explanation = PUBLIC_TRUST_MARKERS.find((m) => m.key === "dispute_rate")!.explanation;

    expect(badge).toHaveAttribute("title", explanation);
    expect(badge).toHaveTextContent(explanation);
  });
});

describe("TrustBadges absence versus measured zero", () => {
  const emptyShop: PublicTrustMetrics = {
    averageReplyTimeMinutes: null,
    responseRate: null,
    descriptionAccuracy: null,
    onTimeShippingRate: null,
    orderCompletionRate: null,
    disputeRate: null,
    totalOrders: 0,
    averageRating: null,
    reviewCount: 0,
    lastActiveDaysAgo: null,
    sellerActiveDaysAgo: null,
    evaluatedAt: "2026-08-20T00:00:00.000Z",
  };

  it("never shows a 0% rate the plaza never measured", () => {
    render(
      <TrustBadges metrics={{ status: "ready", metrics: emptyShop }} profile={profile} />,
    );

    const badge = screen.getByTestId("trust-badge-response_rate");

    expect(badge).toHaveAttribute("data-state", "empty");
    expect(badge).toHaveTextContent("Sin historial de respuesta");
    expect(badge.textContent).not.toMatch(/0\s*%/);
  });

  it("gives a real zero its own state, distinct from an absence", () => {
    render(
      <TrustBadges
        metrics={{ status: "ready", metrics: { ...emptyShop, responseRate: 0 } }}
        profile={profile}
      />,
    );

    const badge = screen.getByTestId("trust-badge-response_rate");

    expect(badge).toHaveAttribute("data-state", "zero");
    expect(badge).toHaveTextContent("0%");
  });

  it("says a shop has no sales or reviews instead of printing bare zeroes", () => {
    render(
      <TrustBadges metrics={{ status: "ready", metrics: emptyShop }} profile={profile} />,
    );

    expect(screen.getByTestId("trust-badge-total_orders")).toHaveTextContent(
      "Sin ventas registradas",
    );
    expect(screen.getByTestId("trust-badge-review_count")).toHaveTextContent("Aún sin reseñas");
    expect(screen.getByTestId("trust-badge-rating")).toHaveTextContent("Aún sin reseñas");
  });

  it("never prints a malformed rate", () => {
    render(
      <TrustBadges metrics={{ status: "ready", metrics: emptyShop }} profile={profile} />,
    );

    expect(screen.getByRole("list", { name: "Marcadores de confianza" }).textContent).not.toMatch(
      /sin datos\s*%/i,
    );
  });
});
