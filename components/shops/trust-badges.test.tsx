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
      const badge = screen.getByTestId(`trust-badge-${marker.key}`);

      expect(badge).toHaveAttribute("data-state", "unmeasured");
      expect(badge).toHaveTextContent("Sin datos");
    }
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
