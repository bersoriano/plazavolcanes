import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TrustDashboardCard } from "@/components/shops/trust-dashboard-card";
import type { TrustDashboard } from "@/lib/trust-tiers";

afterEach(cleanup);

function dashboard(overrides: Partial<TrustDashboard> = {}): TrustDashboard {
  return {
    tier: "reliable",
    listingLimit: 40,
    publishedCount: 7,
    evaluatedAt: "2026-09-01T00:00:00.000Z",
    metrics: {
      averageReplyTimeMinutes: 42,
      responseRate: 96,
      descriptionAccuracy: 98,
      onTimeShippingRate: 91,
      orderCompletionRate: 99,
      disputeRate: 1,
      totalOrders: 120,
      averageRating: 4.8,
      reviewCount: 44,
      lastActiveDaysAgo: 1,
      openDisputeCount: 0,
    },
    reasons: ["Respondes rápido."],
    nextRequirements: ["Mantén el nivel tres meses."],
    summary: "Tu tienda cumple los requisitos del nivel Confiable.",
    ...overrides,
  };
}

function confianza() {
  // Anchored on the Confianza eyebrow, not on "the first <details>": the panel
  // already contains a nested "Cómo subir de nivel" disclosure, and a loose
  // query matches that one and passes without the outer fold existing at all.
  const root = screen.getByText("Confianza").closest("details");
  if (!root) throw new Error("Confianza is not a disclosure");
  const summary = root.querySelector("summary");
  if (!summary) throw new Error("Confianza disclosure has no summary");
  return { root, summary: summary as HTMLElement };
}

describe("trust dashboard disclosure", () => {
  it("stays folded until the seller asks for it", () => {
    // Confianza is a monthly read; the catalogue is the daily one. Open by
    // default it costs a phone screen of scrolling before the first product.
    render(<TrustDashboardCard dashboard={dashboard()} />);

    expect(confianza().root).not.toHaveAttribute("open");
  });

  it("keeps the publication count readable while folded", () => {
    // The one number a seller checks in passing is how much of the limit is
    // spent, so it rides on the summary instead of hiding inside the panel.
    render(<TrustDashboardCard dashboard={dashboard()} />);

    expect(within(confianza().summary).getByText(/7 de 40 publicaciones/)).toBeInTheDocument();
  });

  it("names the tier on the summary", () => {
    render(<TrustDashboardCard dashboard={dashboard()} />);

    expect(within(confianza().summary).getByText(/Confiable/)).toBeInTheDocument();
  });

  it("reports how much of the limit is spent", () => {
    render(<TrustDashboardCard dashboard={dashboard({ publishedCount: 10, listingLimit: 40 })} />);

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
  });

  it("keeps the metrics behind the fold", () => {
    render(<TrustDashboardCard dashboard={dashboard()} />);

    expect(screen.getByText("Envíos puntuales")).toBeInTheDocument();
    expect(within(confianza().summary).queryByText("Envíos puntuales")).toBeNull();
  });

  it("still names the top tier when there is nothing left to reach", () => {
    render(<TrustDashboardCard dashboard={dashboard({ tier: "top_rated", nextRequirements: [] })} />);

    expect(screen.getByText("Cumples el nivel máximo.")).toBeInTheDocument();
  });
});
