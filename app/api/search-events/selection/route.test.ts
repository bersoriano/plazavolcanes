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

  it.each([
    ["pending shop", { is_admin_enabled: true, shops: { is_publishing_approved: false } }],
    ["admin-disabled product", { is_admin_enabled: false, shops: { is_publishing_approved: true } }],
  ])("does not record a selection for a published product from a %s", async (_reason, gate) => {
    mocks.isSupabaseConfigured.mockReturnValue(true);
    const candidate = {
      id: 42,
      status: "published",
      expires_at: "2026-09-01T00:00:00.000Z",
      ...gate,
    };
    const filters = new Map<string, unknown>();
    let requiresExpiry = false;
    const query = {
      eq: vi.fn(function (column: string, value: unknown) {
        filters.set(column, value);
        return query;
      }),
      not: vi.fn(function (column: string, operator: string, value: unknown) {
        requiresExpiry = column === "expires_at" && operator === "is" && value === null;
        return query;
      }),
      gt: vi.fn(function () {
        return query;
      }),
      maybeSingle: vi.fn().mockImplementation(async () => ({
        data: (!filters.has("status") || candidate.status === filters.get("status")) &&
          (!filters.has("is_admin_enabled") ||
            candidate.is_admin_enabled === filters.get("is_admin_enabled")) &&
          (!filters.has("shops.is_publishing_approved") ||
            candidate.shops.is_publishing_approved === filters.get("shops.is_publishing_approved")) &&
          (!requiresExpiry || candidate.expires_at !== null)
          ? candidate
          : null,
      })),
    };
    const rpc = vi.fn();
    mocks.createServerSupabaseClient.mockResolvedValue({
      from: vi.fn(() => ({ select: vi.fn(() => query) })),
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
    expect(query.eq).toHaveBeenCalledWith("status", "published");
    expect(query.eq).toHaveBeenCalledWith("is_admin_enabled", true);
    expect(query.eq).toHaveBeenCalledWith("shops.is_publishing_approved", true);
    expect(query.not).toHaveBeenCalledWith("expires_at", "is", null);
    expect(query.gt).toHaveBeenCalledWith("expires_at", expect.any(String));
    expect(rpc).not.toHaveBeenCalled();
  });
});
