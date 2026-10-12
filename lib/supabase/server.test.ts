import { beforeEach, expect, it, vi } from "vitest";

const { set, getAll, createServerClient } = vi.hoisted(() => ({ set: vi.fn(), getAll: vi.fn(), createServerClient: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set, getAll }) }));
vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig: () => ({ url: "http://127.0.0.1:54321", publishableKey: "public" }) }));
const { createServerSupabaseClient } = await import("./server");
beforeEach(() => vi.resetAllMocks());

it("propagates callback cookie failures rather than claiming sign-in succeeded", async () => {
  await createServerSupabaseClient({ strictCookies: true });
  set.mockImplementation(() => { throw new Error("cookie write failed"); });
  const options = createServerClient.mock.calls[0][2];
  expect(() => options.cookies.setAll([{ name: "session", value: "token", options: {} }])).toThrow("cookie write failed");
});

it("still allows read-only Server Components to rely on proxy cookie refresh", async () => {
  await createServerSupabaseClient();
  set.mockImplementation(() => { throw new Error("read only"); });
  const options = createServerClient.mock.calls[0][2];
  expect(() => options.cookies.setAll([{ name: "session", value: "token", options: {} }])).not.toThrow();
});
