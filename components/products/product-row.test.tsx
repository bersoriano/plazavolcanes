import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProductRow } from "@/components/products/product-row";

vi.mock("@/lib/actions/products", () => ({
  deleteProduct: { bind: () => vi.fn() },
  setProductStatus: { bind: () => vi.fn() },
}));

afterEach(cleanup);

function product(overrides: Partial<Parameters<typeof ProductRow>[0]["product"]> = {}) {
  return {
    id: 1,
    name: "Taza de barro",
    price_mxn: 480,
    image_path: null,
    status: "published" as const,
    expires_at: "2026-09-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("ProductRow", () => {
  it("tells a seller when a live listing runs out", () => {
    render(<ProductRow product={product()} />);

    expect(screen.getByText(/Vence el/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Despublicar" })).toBeInTheDocument();
  });

  it("offers to bring an expired listing back", () => {
    render(<ProductRow product={product({ status: "expired", expires_at: "2026-08-01T00:00:00.000Z" })} />);

    expect(screen.getByText("Vencido")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reactivar" })).toBeInTheDocument();
    expect(screen.getByText(/Venció el/)).toBeInTheDocument();
  });

  it("says nothing about expiry on a draft", () => {
    render(<ProductRow product={product({ status: "draft", expires_at: null })} />);

    expect(screen.queryByText(/Vence|Venció/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar" })).toBeInTheDocument();
  });
});
