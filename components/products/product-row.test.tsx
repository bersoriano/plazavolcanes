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
    is_admin_enabled: true,
    is_publishing_approved: true,
    ...overrides,
  };
}

describe("ProductRow", () => {
  it("shows the effective seller publication state", () => {
    render(<ProductRow product={product()} />);

    expect(screen.getByText("Publicado")).toBeInTheDocument();
    expect(screen.getByText(/Vence el/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Despublicar" })).toBeInTheDocument();
  });

  it.each([
    ["seller-disabled", product({ status: "draft", expires_at: null }), "Desactivado por ti"],
    ["approval-pending", product({ is_publishing_approved: false, expires_at: null }), "Esperando aprobación de administración"],
    ["product-admin-disabled", product({ is_admin_enabled: false, expires_at: null }), "Deshabilitado por administración"],
    ["expired", product({ status: "expired", expires_at: "2026-08-01T00:00:00.000Z" }), "Vencido"],
  ] as const)("labels a %s listing as %s", (_state, listing, label) => {
    render(<ProductRow product={listing} />);

    expect(screen.getByText(label)).toBeInTheDocument();
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
