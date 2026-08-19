import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/config", () => ({
  isSupabaseConfigured: () => false,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
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
});
