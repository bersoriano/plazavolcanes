import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isSignedIn, listContactMessages } from "@/lib/queries/contact.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const mocks = vi.hoisted(() => ({ configured: vi.fn() }));

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: mocks.configured }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));

let rpc: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mocks.configured.mockReturnValue(true);
  rpc = vi.fn();
  vi.mocked(createServerSupabaseClient).mockResolvedValue({ rpc } as never);
});
afterEach(() => vi.clearAllMocks());

describe("isSignedIn", () => {
  it.each([
    [{ data: { claims: { sub: "user-1" } } }, true],
    [{ data: null }, false],
    [{ data: { claims: { sub: "" } } }, false],
  ])("reads %j as %s", async (answer, expected) => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getClaims: async () => answer },
    } as never);

    await expect(isSignedIn()).resolves.toBe(expected);
  });

  it("reads as signed out when nothing is configured", async () => {
    mocks.configured.mockReturnValue(false);

    await expect(isSignedIn()).resolves.toBe(false);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });
});

describe("listContactMessages", () => {
  it("reads what has arrived", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          id: "m-1",
          has_account: false,
          name: "Luis Pérez",
          email: "luis@correo.test",
          phone: "+525587654321",
          message: "No llegó mi pedido.",
          created_at: "2026-10-13T16:42:00Z",
          attended_at: null,
        },
      ],
      error: null,
    });

    await expect(listContactMessages()).resolves.toEqual([
      {
        id: "m-1",
        hasAccount: false,
        name: "Luis Pérez",
        email: "luis@correo.test",
        phone: "+525587654321",
        message: "No llegó mi pedido.",
        createdAt: "2026-10-13T16:42:00Z",
        attendedAt: null,
      },
    ]);
    expect(rpc).toHaveBeenCalledWith("list_contact_messages");
  });

  it("reads as nothing when the list cannot be read", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(listContactMessages()).resolves.toEqual([]);
  });

  it("reads as nothing when nothing is configured", async () => {
    mocks.configured.mockReturnValue(false);

    await expect(listContactMessages()).resolves.toEqual([]);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });
});
