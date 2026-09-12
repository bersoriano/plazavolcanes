import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProductRow } from "@/components/products/product-row";

const { setProductStatus } = vi.hoisted(() => ({ setProductStatus: vi.fn() }));

vi.mock("@/lib/actions/products", () => ({ deleteProduct: vi.fn(), setProductStatus }));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(setProductStatus).mockResolvedValue({ status: "idle", message: "" });
});

function product(overrides: Partial<Parameters<typeof ProductRow>[0]["product"]> = {}) {
  return {
    id: 1,
    name: "Taza de barro",
    price_mxn: 480,
    image_url: null,
    status: "published" as const,
    expires_at: "2026-09-20T00:00:00.000Z",
    is_admin_enabled: true,
    is_publishing_approved: true,
    publishing_reviewed_at: "2026-08-29T00:00:00.000Z",
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
    ["approval-pending", product({ is_publishing_approved: false, publishing_reviewed_at: null, expires_at: null }), "Esperando aprobación de administración"],
    ["shop-admin-disabled", product({ is_publishing_approved: false, publishing_reviewed_at: "2026-08-29T00:00:00.000Z", expires_at: null }), "Tienda deshabilitada por administración"],
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

  it("announces the gate-aware result returned by the publication action", async () => {
    vi.mocked(setProductStatus).mockResolvedValueOnce({
      status: "success",
      message: "Producto guardado. Está pendiente de aprobación de administración.",
    });
    render(<ProductRow product={product({ status: "draft", expires_at: null })} />);

    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Producto guardado. Está pendiente de aprobación de administración.",
    );
  });
});

function inDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

describe("expiry urgency", () => {
  it("counts down a listing that is about to lapse", () => {
    // A listing stops selling the moment it expires, with no other warning.
    // A date alone makes the seller do the arithmetic; the count does it here.
    render(<ProductRow product={product({ expires_at: inDays(4) })} />);

    expect(screen.getByText("Vence en 4 días")).toBeInTheDocument();
  });

  it("says tomorrow rather than counting one day", () => {
    render(<ProductRow product={product({ expires_at: inDays(1) })} />);

    expect(screen.getByText("Vence mañana")).toBeInTheDocument();
  });

  it("says today on the last day", () => {
    render(<ProductRow product={product({ expires_at: inDays(0.4) })} />);

    expect(screen.getByText("Vence hoy")).toBeInTheDocument();
  });

  it("gives a distant date no urgency", () => {
    // Every row counting down would make the warning worth nothing.
    render(<ProductRow product={product({ expires_at: inDays(40) })} />);

    expect(screen.getByText(/^Vence el /)).toBeInTheDocument();
    expect(screen.queryByText(/Vence en|Vence hoy|Vence mañana/)).not.toBeInTheDocument();
  });

  it("marks the countdown so it does not read as ordinary detail", () => {
    render(<ProductRow product={product({ expires_at: inDays(2) })} />);

    expect(screen.getByText("Vence en 2 días")).toHaveClass("text-sale");
  });
});
