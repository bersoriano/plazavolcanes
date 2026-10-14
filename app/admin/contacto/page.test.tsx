import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdmin } from "@/lib/admin-auth.server";
import { listContactMessages } from "@/lib/queries/contact.server";

vi.mock("@/lib/admin-auth.server", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/queries/contact.server", () => ({ listContactMessages: vi.fn() }));
vi.mock("@/lib/actions/contact", () => ({ markContactMessageAttended: vi.fn() }));

const { default: AdminContactPage } = await import("@/app/admin/contacto/page");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAdmin).mockResolvedValue(undefined);
  vi.mocked(listContactMessages).mockResolvedValue([
    {
      id: "30000000-0000-4000-8000-000000000001",
      hasAccount: false,
      name: "Luis Pérez",
      email: "luis@correo.test",
      phone: "+525587654321",
      message: "No llegó mi pedido.",
      createdAt: "2026-10-13T16:42:00Z",
      attendedAt: null,
    },
  ]);
});

afterEach(cleanup);

describe("AdminContactPage", () => {
  it("is for administrators only", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("REDIRECT"));

    await expect(AdminContactPage()).rejects.toThrow("REDIRECT");
    expect(listContactMessages).not.toHaveBeenCalled();
  });

  it("lists what has arrived", async () => {
    render(await AdminContactPage());

    expect(screen.getByRole("heading", { level: 1, name: "Contacto" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Luis Pérez" })).toBeInTheDocument();
  });

  it("says where the messages come from", async () => {
    render(await AdminContactPage());

    expect(screen.getByRole("link", { name: "Quejas y aclaraciones" })).toHaveAttribute(
      "href",
      "/quejas-y-aclaraciones",
    );
  });
});
