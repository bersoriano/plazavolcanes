import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isSupabaseConfigured: vi.fn(() => false),
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/supabase/config", () => ({
  isSupabaseConfigured: mocks.isSupabaseConfigured,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));

import { POST } from "@/app/api/search-events/selection/route";

describe("POST /api/search-events/selection", () => {
  it("returns 400 for invalid input even when Supabase is unavailable", async () => {
    const response = await POST(
      new Request("http://localhost/api/search-events/selection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId: "not-a-uuid",
          productId: 42,
          position: 0,
        }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("returns 503 for valid input when Supabase is unavailable", async () => {
    const response = await POST(
      new Request("http://localhost/api/search-events/selection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId: "1f505b54-3e35-4d7c-9a22-472920dfd72b",
          productId: 42,
          position: 1,
        }),
      }),
    );

    expect(response.status).toBe(503);
  });

  it("does not record a selection for a product hidden by a moderation gate", async () => {
    mocks.isSupabaseConfigured.mockReturnValue(true);
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const gt = vi.fn(() => ({ maybeSingle }));
    const not = vi.fn(() => ({ gt }));
    const eq = vi.fn(() => ({ eq, not, maybeSingle }));
    const rpc = vi.fn();
    mocks.createServerSupabaseClient.mockResolvedValue({
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq, not, maybeSingle })) })),
      rpc,
    });

    const response = await POST(
      new Request("http://localhost/api/search-events/selection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId: "1f505b54-3e35-4d7c-9a22-472920dfd72b",
          productId: 42,
          position: 1,
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(eq).toHaveBeenCalledWith("status", "published");
    expect(eq).toHaveBeenCalledWith("is_admin_enabled", true);
    expect(eq).toHaveBeenCalledWith("shops.is_publishing_approved", true);
    expect(not).toHaveBeenCalledWith("expires_at", "is", null);
    expect(gt).toHaveBeenCalledWith("expires_at", expect.any(String));
    expect(rpc).not.toHaveBeenCalled();
  });
});
