import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdmin } from "@/lib/admin-auth.server";
import { getAdminMarketplaceUsers } from "@/lib/queries/admin.server";

vi.mock("@/lib/admin-auth.server", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/queries/admin.server", () => ({ getAdminMarketplaceUsers: vi.fn() }));

const { default: AdminUsersPage } = await import("@/app/admin/usuarios/page");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAdmin).mockResolvedValue(undefined);
  vi.mocked(getAdminMarketplaceUsers).mockResolvedValue([
    {
      id: "persona-1",
      email: "lucia@tallervolcan.mx",
      displayName: "Lucía Martínez",
      createdAt: "2026-08-01T00:00:00.000Z",
      shops: [
        {
          id: 1,
          name: "Taller Volcán",
          slug: "taller-volcan",
          createdAt: "2026-08-02T00:00:00.000Z",
          isPublishingApproved: false,
          products: [],
        },
      ],
    },
  ]);
});

afterEach(cleanup);

describe("AdminUsersPage", () => {
  it("does not query marketplace users when authorization rejects", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("REDIRECT"));

    await expect(AdminUsersPage()).rejects.toThrow("REDIRECT");

    expect(getAdminMarketplaceUsers).not.toHaveBeenCalled();
  });

  it("loads and displays the marketplace users", async () => {
    render(await AdminUsersPage());

    expect(screen.getByText("lucia@tallervolcan.mx")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Publicaciones habilitadas" })).not.toBeChecked();
    expect(screen.getByText("Publicaciones pendientes")).toBeInTheDocument();
    expect(requireAdmin).toHaveBeenCalledOnce();
    expect(getAdminMarketplaceUsers).toHaveBeenCalledOnce();
  });
});
