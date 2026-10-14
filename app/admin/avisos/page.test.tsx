import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdmin } from "@/lib/admin-auth.server";
import { getNoticeAudienceCounts, listNoticeBatches } from "@/lib/queries/platform-notices.server";

vi.mock("@/lib/admin-auth.server", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/queries/platform-notices.server", () => ({
  getNoticeAudienceCounts: vi.fn(),
  listNoticeBatches: vi.fn(),
}));
vi.mock("@/lib/actions/platform-notices", () => ({ retractNotice: vi.fn(), sendNotice: vi.fn() }));

const { default: AdminNoticesPage } = await import("@/app/admin/avisos/page");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAdmin).mockResolvedValue(undefined);
  vi.mocked(getNoticeAudienceCounts).mockResolvedValue({ everyone: 214, sellers: 38, buyers: 176 });
  vi.mocked(listNoticeBatches).mockResolvedValue([
    {
      id: "20000000-0000-4000-8000-000000000001",
      audience: "everyone",
      recipientLabel: null,
      title: "Mantenimiento el sábado",
      body: "La plaza estará en pausa.",
      action: null,
      recipientCount: 214,
      readCount: 131,
      createdAt: "2026-10-12T16:42:00Z",
      retractedAt: null,
    },
  ]);
});

afterEach(cleanup);

describe("AdminNoticesPage", () => {
  it("is for administrators only", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("REDIRECT"));

    await expect(AdminNoticesPage()).rejects.toThrow("REDIRECT");
    expect(listNoticeBatches).not.toHaveBeenCalled();
  });

  it("offers a new announcement with how many people each audience reaches", async () => {
    render(await AdminNoticesPage());

    expect(screen.getByRole("heading", { level: 1, name: "Avisos y anuncios" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Todas las personas.*214/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Quienes venden.*38/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Quienes solo compran.*176/ })).toBeInTheDocument();
  });

  it("lists what has been sent", async () => {
    render(await AdminNoticesPage());

    const sent = screen.getByRole("region", { name: "Enviados" });
    expect(within(sent).getByRole("heading", { name: "Mantenimiento el sábado" })).toBeInTheDocument();
    expect(within(sent).getByText("Todas las personas · 214 enviados · 131 leídos")).toBeInTheDocument();
  });

  it("says where a notice to one person is written", async () => {
    render(await AdminNoticesPage());

    expect(screen.getByRole("link", { name: "Usuarios" })).toHaveAttribute("href", "/admin/usuarios");
  });
});
