import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAdminMarketplaceUsers } from "@/lib/queries/admin.server";

vi.mock("@/lib/queries/admin.server", () => ({ getAdminMarketplaceUsers: vi.fn() }));

const { default: AdminUsersPage } = await import("@/app/admin/usuarios/page");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAdminMarketplaceUsers).mockResolvedValue([
    {
      id: "persona-1",
      email: "lucia@tallervolcan.mx",
      displayName: "Lucía Martínez",
      createdAt: "2026-08-01T00:00:00.000Z",
      shops: [],
    },
  ]);
});

afterEach(cleanup);

describe("AdminUsersPage", () => {
  it("loads and displays the marketplace users", async () => {
    render(await AdminUsersPage());

    expect(screen.getByText("lucia@tallervolcan.mx")).toBeInTheDocument();
    expect(getAdminMarketplaceUsers).toHaveBeenCalledOnce();
  });
});
