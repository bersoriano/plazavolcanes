import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/shops", () => ({ createShop: vi.fn() }));
vi.mock("@/components/shops/shop-form", () => ({ ShopForm: () => <form aria-label="Tienda" /> }));

const { default: NewShopPage } = await import("@/app/panel/tiendas/nueva/page");

afterEach(cleanup);

describe("NewShopPage", () => {
  it("opens on the form, under its own title", () => {
    render(<NewShopPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Crea tu tienda" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Tienda" })).toBeInTheDocument();
  });

  it("leaves the way around the panel to the panel's bar", () => {
    render(<NewShopPage />);

    expect(screen.queryAllByRole("link")).toEqual([]);
  });
});
