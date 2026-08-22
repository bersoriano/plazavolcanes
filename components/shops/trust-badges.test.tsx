import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TrustBadges } from "@/components/shops/trust-badges";
import { PUBLIC_TRUST_MARKERS } from "@/lib/public-trust";

afterEach(cleanup);

const fullMetrics = {
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

const profile = { joinedOn: "2026-02-01", verificationLevel: "basic" as const };

describe("TrustBadges", () => {
  it("renders a badge for every trust signal, metrics plus membership and verification", () => {
    render(<TrustBadges metrics={fullMetrics} profile={profile} />);

    const list = screen.getByRole("list", { name: "Marcadores de confianza" });

    expect(within(list).getAllByRole("listitem")).toHaveLength(
      PUBLIC_TRUST_MARKERS.length + 2,
    );
  });

  it("marks a measured signal as active and shows its value", () => {
    render(<TrustBadges metrics={fullMetrics} profile={profile} />);

    const badge = screen.getByTestId("trust-badge-response_rate");

    expect(badge).toHaveAttribute("data-state", "measured");
    expect(badge).toHaveTextContent("Respuesta");
    expect(badge).toHaveTextContent("98%");
  });

  it("greys out a signal with nothing measured yet", () => {
    render(<TrustBadges metrics={null} profile={profile} />);

    for (const marker of PUBLIC_TRUST_MARKERS) {
      // A clean dispute record is earned by default, so it is never greyed.
      if (marker.key === "dispute_rate") continue;

      const badge = screen.getByTestId(`trust-badge-${marker.key}`);

      expect(badge).toHaveAttribute("data-state", "unmeasured");
      expect(badge).toHaveTextContent("Sin datos");
    }
  });

  it("gives a shop with no disputes the badge even before any evaluation", () => {
    render(<TrustBadges metrics={null} profile={profile} />);

    const badge = screen.getByTestId("trust-badge-dispute_rate");

    expect(badge).toHaveAttribute("data-state", "measured");
    expect(badge).toHaveTextContent("Sin disputas");
  });

  it("keeps membership and verification active when the profile exists", () => {
    render(<TrustBadges metrics={null} profile={profile} />);

    expect(screen.getByTestId("trust-badge-membership")).toHaveAttribute(
      "data-state",
      "measured",
    );
    expect(screen.getByTestId("trust-badge-verification")).toHaveAttribute(
      "data-state",
      "measured",
    );
  });

  it("greys out membership and verification when no profile exists", () => {
    render(<TrustBadges metrics={fullMetrics} profile={null} />);

    expect(screen.getByTestId("trust-badge-membership")).toHaveAttribute(
      "data-state",
      "unmeasured",
    );
    expect(screen.getByTestId("trust-badge-verification")).toHaveAttribute(
      "data-state",
      "unmeasured",
    );
  });

  it("explains each signal for hover and for screen readers", () => {
    render(<TrustBadges metrics={fullMetrics} profile={profile} />);

    const badge = screen.getByTestId("trust-badge-dispute_rate");
    const explanation = PUBLIC_TRUST_MARKERS.find((m) => m.key === "dispute_rate")!.explanation;

    expect(badge).toHaveAttribute("title", explanation);
    expect(badge).toHaveTextContent(explanation);
  });
});

describe("TrustBadges absence versus achievement", () => {
  const emptyShop = {
    averageReplyTimeMinutes: null,
    responseRate: null,
    descriptionAccuracy: null,
    onTimeShippingRate: null,
    orderCompletionRate: null,
    disputeRate: 0,
    totalOrders: 0,
    averageRating: null,
    reviewCount: 0,
    lastActiveDaysAgo: null,
    sellerActiveDaysAgo: null,
    evaluatedAt: "2026-08-20T00:00:00.000Z",
  };

  it("greys a zero order and review count while keeping the number visible", () => {
    render(<TrustBadges metrics={emptyShop} profile={profile} />);

    for (const key of ["total_orders", "review_count"]) {
      const badge = screen.getByTestId(`trust-badge-${key}`);

      expect(badge).toHaveAttribute("data-state", "unmeasured");
      expect(badge).toHaveTextContent("0");
    }
  });

  it("keeps a zero dispute rate filled in, because it was earned", () => {
    render(<TrustBadges metrics={emptyShop} profile={profile} />);

    const badge = screen.getByTestId("trust-badge-dispute_rate");

    expect(badge).toHaveAttribute("data-state", "measured");
    expect(badge).toHaveTextContent("Sin disputas");
  });

  it("greys an unverified account while naming its level", () => {
    render(
      <TrustBadges
        metrics={emptyShop}
        profile={{ joinedOn: "2026-02-01", verificationLevel: "unverified" }}
      />,
    );

    const badge = screen.getByTestId("trust-badge-verification");

    expect(badge).toHaveAttribute("data-state", "unmeasured");
    expect(badge).toHaveTextContent("Sin verificar");
  });

  it("fills the badge in once the account is verified", () => {
    render(
      <TrustBadges
        metrics={emptyShop}
        profile={{ joinedOn: "2026-02-01", verificationLevel: "verified" }}
      />,
    );

    expect(screen.getByTestId("trust-badge-verification")).toHaveAttribute(
      "data-state",
      "measured",
    );
  });
});
