import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PublicTrustPanel } from "@/components/shops/public-trust-panel";
import { PUBLIC_TRUST_MARKERS } from "@/lib/public-trust";

afterEach(cleanup);

const measured = {
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

describe("PublicTrustPanel", () => {
  it("lists every tracked dimension with its value", () => {
    render(<PublicTrustPanel metrics={measured} />);

    const region = screen.getByRole("region", { name: "Qué mide Plaza Volcanes" });
    for (const marker of PUBLIC_TRUST_MARKERS) {
      expect(within(region).getByText(marker.label)).toBeInTheDocument();
    }
    expect(within(region).getByText("98%")).toBeInTheDocument();
    expect(within(region).getByText("42 min")).toBeInTheDocument();
    expect(within(region).getByText("2%")).toBeInTheDocument();
    expect(within(region).getByText("4.8 · 12 reseñas")).toBeInTheDocument();
    expect(within(region).getByText("Hace 1 día")).toBeInTheDocument();
  });

  it("still names every dimension for a shop that has never been evaluated", () => {
    render(<PublicTrustPanel metrics={null} />);

    const region = screen.getByRole("region", { name: "Qué mide Plaza Volcanes" });
    for (const marker of PUBLIC_TRUST_MARKERS) {
      expect(within(region).getByText(marker.label)).toBeInTheDocument();
    }
    expect(within(region).getAllByText("Sin datos aún")).toHaveLength(
      PUBLIC_TRUST_MARKERS.length,
    );
  });

  it("explains what each dimension means", () => {
    render(<PublicTrustPanel metrics={measured} />);

    const region = screen.getByRole("region", { name: "Qué mide Plaza Volcanes" });
    for (const marker of PUBLIC_TRUST_MARKERS) {
      expect(within(region).getByText(marker.explanation)).toBeInTheDocument();
    }
  });
});
