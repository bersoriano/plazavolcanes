import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rows = new Map<string, unknown>();

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: "user-1", email: "tienda@example.com" } } }) },
    from: (table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: rows.get(table) ?? null }) }) }),
    }),
    rpc: async () => ({ data: "Bear" }),
  }),
}));
vi.mock("@/lib/actions/auth", () => ({ updateDisplayName: vi.fn(), updatePhone: vi.fn() }));
vi.mock("@/lib/actions/notifications", () => ({ updateEmailNotifications: vi.fn() }));

const { default: AccountPage } = await import("@/app/panel/cuenta/page");

afterEach(cleanup);
beforeEach(() => rows.clear());

describe("AccountPage email notifications", () => {
  it("shows emails on for a seller who never touched the switch", async () => {
    render(await AccountPage());

    expect(screen.getByRole("checkbox", { name: /Avísame por correo/ })).toBeChecked();
    expect(screen.getByText(/Te escribimos a tienda@example\.com/)).toBeInTheDocument();
  });

  it("shows emails off for a seller who switched them off", async () => {
    rows.set("notification_preferences", { email_enabled: false });

    render(await AccountPage());

    expect(screen.getByRole("checkbox", { name: /Avísame por correo/ })).not.toBeChecked();
  });
});
