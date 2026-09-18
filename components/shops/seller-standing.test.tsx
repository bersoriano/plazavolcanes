import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  PremiumNote,
  SellerBadges,
  SellerStanding,
  SellingHistoryNote,
} from "@/components/shops/seller-standing";
import type { PublicTrustMetrics } from "@/lib/public-trust";

afterEach(cleanup);

const blank: PublicTrustMetrics = {
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
  evaluatedAt: "2026-09-01T00:00:00.000Z",
};

const profile = { joinedOn: "2026-02-01" };

describe("SellerBadges", () => {
  it("gives a brand new premium shop its distinction and no competing rank", () => {
    render(<SellerBadges premium tier="standard" />);

    expect(screen.getByTestId("premium-badge")).toHaveTextContent("Premium");
    expect(screen.queryByTestId("reputation-badge")).toBeNull();
    expect(screen.queryByText(/Estándar/)).toBeNull();
  });

  it("shows Premium and an earned tier together, without either denying the other", () => {
    render(<SellerBadges premium tier="top_rated" />);

    expect(screen.getByTestId("premium-badge")).toBeInTheDocument();
    expect(screen.getByTestId("reputation-badge")).toHaveTextContent("Mejor valorada");
  });

  it("renders nothing for an ordinary shop in the starting tier", () => {
    const { container } = render(<SellerBadges premium={false} tier="standard" />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("PremiumNote", () => {
  it("states what Premium is without waiting for a hover", () => {
    render(<PremiumNote />);

    expect(screen.getByText("Distinción otorgada por Plaza Volcanes.")).toBeInTheDocument();
  });

  it("puts the longer explanation behind a keyboard- and touch-operable disclosure", () => {
    render(<PremiumNote />);

    // A <summary> is focusable and operable with Enter or Space by the browser,
    // which a hover-only tooltip never was.
    const disclosure = screen.getByText(/Qué incluye la distinción Premium/);
    expect(disclosure.tagName).toBe("SUMMARY");
    expect(disclosure.closest("details")).toBeInTheDocument();
  });

  it("claims no vetting, no guarantee and no protection", () => {
    render(<PremiumNote />);

    const note = screen.getByTestId("premium-note");
    expect(note.textContent).not.toMatch(/verificad|garantiz|protecc|asegur(a|ad)/i);
    expect(note).toHaveTextContent(/El historial de ventas se calcula aparte/);
  });
});

describe("SellingHistoryNote", () => {
  it("says a new shop is still without reviews, not that it responds 0%", () => {
    render(<SellingHistoryNote metrics={{ status: "ready", metrics: blank }} />);

    const note = screen.getByTestId("selling-history");
    expect(note).toHaveTextContent("Historial de ventas: aún sin reseñas");
    expect(note.textContent).not.toMatch(/0\s*%/);
  });

  it("renders a failed read differently from an empty history", () => {
    const { rerender } = render(<SellingHistoryNote metrics={{ status: "unavailable" }} />);
    const failed = screen.getByTestId("selling-history").textContent;

    rerender(<SellingHistoryNote metrics={{ status: "pending" }} />);
    const empty = screen.getByTestId("selling-history").textContent;

    expect(failed).not.toBe(empty);
    expect(failed).toMatch(/no disponible/);
    expect(empty).toMatch(/construyendo su historial/);
  });

  it("adds the new-seller note only when the join date supports it", () => {
    const { rerender } = render(
      <SellingHistoryNote
        joinedOn={new Date().toISOString().slice(0, 10)}
        metrics={{ status: "pending" }}
      />,
    );

    expect(screen.getByTestId("selling-history")).toHaveTextContent("Nuevo en Plaza Volcanes");

    rerender(<SellingHistoryNote joinedOn="2023-01-01" metrics={{ status: "pending" }} />);

    expect(screen.getByTestId("selling-history")).not.toHaveTextContent("Nuevo en Plaza Volcanes");
  });

  it("keeps real results, good or bad, in the summary", () => {
    render(
      <SellingHistoryNote
        metrics={{
          status: "ready",
          metrics: { ...blank, totalOrders: 30, reviewCount: 20, averageRating: 2.1 },
        }}
      />,
    );

    expect(screen.getByTestId("selling-history")).toHaveTextContent(
      "30 pedidos completados · 2.1 de 5 en 20 reseñas",
    );
  });
});

describe("SellerStanding", () => {
  it("keeps a new premium storefront to a summary rather than a grid of blanks", () => {
    render(
      <SellerStanding
        joinedOn={profile.joinedOn}
        metrics={{ status: "ready", metrics: blank }}
        premium
        profile={profile}
      />,
    );

    const details = screen.getByText(/Ver todo lo que Plaza Volcanes mide/).closest("details")!;

    expect(details).not.toHaveAttribute("open");
    expect(screen.getByTestId("premium-note")).toBeInTheDocument();
    expect(screen.getByTestId("selling-history")).toHaveTextContent("aún sin reseñas");
  });

  it("opens the measured detail once there is something in it", () => {
    render(
      <SellerStanding
        metrics={{ status: "ready", metrics: { ...blank, totalOrders: 9, responseRate: 91 } }}
        premium={false}
        profile={profile}
      />,
    );

    expect(
      screen.getByText(/Ver todo lo que Plaza Volcanes mide/).closest("details"),
    ).toHaveAttribute("open");
    expect(screen.getByTestId("trust-badge-response_rate")).toHaveTextContent("91%");
  });

  it("shows the retry state instead of the metrics when the read failed", () => {
    render(<SellerStanding metrics={{ status: "unavailable" }} premium profile={profile} />);

    expect(screen.getByTestId("selling-history")).toHaveTextContent("no disponible por ahora");
    expect(screen.getByTestId("selling-history")).toHaveTextContent(/Vuelve a cargar/);
    expect(screen.queryByText(/Ver todo lo que Plaza Volcanes mide/)).toBeNull();
    expect(screen.queryByRole("list", { name: "Marcadores de confianza" })).toBeNull();
    // A failed read is never dressed up as a brand new shop.
    expect(screen.getByTestId("selling-history")).not.toHaveTextContent("Nuevo en Plaza Volcanes");
  });

  it("never implies the distinction was earned by selling", () => {
    render(
      <SellerStanding
        metrics={{ status: "ready", metrics: blank }}
        premium
        profile={profile}
      />,
    );

    const standing = screen.getByRole("region", { name: /Distinción e historial/ });

    expect(within(standing).getByTestId("premium-note")).toBeInTheDocument();
    expect(within(standing).getByTestId("selling-history")).toBeInTheDocument();
  });
});
