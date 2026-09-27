import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ShopAnalyticsCard } from "@/components/shops/shop-analytics-card";
import { summarizeShopAnalytics } from "@/lib/shop-analytics";

afterEach(cleanup);

describe("ShopAnalyticsCard", () => {
  it("shows a founder their numbers and the products nobody asks about", () => {
    const analytics = summarizeShopAnalytics([
      { product_id: 1, name: "Cámara", slug: "camara", status: "published", views: 24, questions: 0, orders: 0 },
      { product_id: 2, name: "Lente", slug: "lente", status: "published", views: 16, questions: 4, orders: 1 },
    ]);

    render(<ShopAnalyticsCard analytics={analytics} isFounder />);

    expect(screen.getByRole("heading", { name: "Estadísticas" })).toBeInTheDocument();
    expect(screen.getByText("Visitas").nextSibling).toHaveTextContent("40");
    expect(screen.getByText("Preguntas por visita").nextSibling).toHaveTextContent("10%");
    expect(screen.getByRole("link", { name: "Cámara" })).toHaveAttribute("href", "/productos/camara");
    expect(screen.getByRole("heading", { name: "Se ven, pero nadie pregunta" })).toBeInTheDocument();
  });

  it("tells every other shop the tool is coming", () => {
    render(<ShopAnalyticsCard analytics={null} isFounder={false} />);

    expect(screen.getByText(/Las tiendas fundadoras las tienen primero; pronto, todas./)).toBeInTheDocument();
    expect(screen.queryByText("Visitas")).not.toBeInTheDocument();
  });
});
