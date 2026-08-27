import { describe, expect, it } from "vitest";

import { generateMemberSinceMarker } from "@/lib/trust-markers";

describe("generateMemberSinceMarker", () => {
  it("returns Spanish member copy and exact active days", () => {
    expect(
      generateMemberSinceMarker({
        join_date: "2026-03-01",
        current_date: "2026-03-31",
      }),
    ).toEqual({
      primary_text: "Miembro desde marzo de 2026",
      tooltip:
        "La antigüedad muestra cuánto tiempo lleva este vendedor activo en Plaza Volcanes y ayuda a evaluar su trayectoria.",
      trust_signal: "Vendedor en crecimiento",
      days_active: 30,
    });
  });

  it.each([
    ["2026-01-01", "2026-01-30", "Vendedor nuevo"],
    ["2026-01-01", "2026-01-31", "Vendedor en crecimiento"],
    ["2026-01-31", "2026-07-30", "Vendedor en crecimiento"],
    ["2026-01-31", "2026-07-31", "Vendedor establecido"],
    ["2024-02-29", "2026-02-28", "Vendedor establecido"],
    ["2024-02-29", "2026-03-01", "Vendedor de larga trayectoria"],
  ])(
    "classifies %s through %s as %s",
    (joinDate, currentDate, trustSignal) => {
      expect(
        generateMemberSinceMarker({
          join_date: joinDate,
          current_date: currentDate,
        }).trust_signal,
      ).toBe(trustSignal);
    },
  );
});
