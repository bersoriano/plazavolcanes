import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SellerPage, { metadata } from "@/app/vender/page";

vi.mock("@/lib/queries/founders.server", () => ({
  getFoundersProgram: vi.fn(async () => ({ open: true, taken: null, cap: 100 })),
  viewerIsFounder: vi.fn(async () => false),
}));
vi.mock("@/lib/admin-auth.server", () => ({
  getCurrentUserAdminStatus: vi.fn(async () => ({ isAdmin: false, signedIn: false })),
}));
vi.mock("@/lib/queries/seller-standing.server", () => ({ viewerOwnsAnyShop: vi.fn(async () => false) }));

afterEach(cleanup);

describe("Seller page", () => {
  it("publishes static metadata for store setup and the direct-sale model", () => {
    expect(metadata).toEqual({
      title: "Vender",
      description:
        "Abre tu tienda en Plaza Volcanes, publica tus productos y acuerda pago y entrega directamente con cada persona compradora.",
      alternates: { canonical: "/vender" },
    });
  });

  it("renders the complete seller program", async () => {
    render(await SellerPage());

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Abre tu tienda gratis y quédate con cada peso.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Crea tu tienda")).toBeInTheDocument();
    expect(screen.getByText("Trae tu reputación")).toBeInTheDocument();
    expect(screen.getByText("Publica y recibe pedidos")).toBeInTheDocument();

    for (const cta of screen.getAllByRole("link", { name: "Crear mi tienda gratis" })) {
      expect(cta.getAttribute("href")).toMatch(/^\/registro\?vender=1(&desde=[a-z]+)?$/);
    }
    expect(screen.getByRole("link", { name: "¿Ya tienes cuenta? Ingresa" })).toHaveAttribute(
      "href",
      "/ingresar?intent=vender",
    );
  });
});
