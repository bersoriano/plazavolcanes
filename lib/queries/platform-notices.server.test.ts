import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PlatformNoticeRow } from "@/lib/queries/platform-notices";
import {
  fetchPlatformNotice,
  getNoticeAudienceCounts,
  listNoticeBatches,
  listPlatformNotices,
} from "@/lib/queries/platform-notices.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));

const row: PlatformNoticeRow = {
  id: 12,
  kind: "announcement",
  title: "Mantenimiento",
  body: "El sábado por la noche.",
  action_href: null,
  action_label: null,
  created_at: "2026-10-12T16:42:00Z",
  read_at: null,
};

/** A query builder that records how it was narrowed and answers when awaited. */
function table(answer: { data: unknown; error: unknown }) {
  const calls: [string, ...unknown[]][] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "order", "limit", "eq"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  builder.maybeSingle = async () => answer;
  builder.then = (resolve: (value: unknown) => unknown) => resolve(answer);

  return { builder, calls };
}

let rpc: ReturnType<typeof vi.fn>;
let notices: ReturnType<typeof table>;

function connect(answer: { data: unknown; error: unknown }) {
  notices = table(answer);
  rpc = vi.fn();
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    from: (name: string) => {
      expect(name).toBe("platform_notices");
      return notices.builder;
    },
    rpc,
  } as never);
}

beforeEach(() => connect({ data: [row], error: null }));
afterEach(() => vi.clearAllMocks());

describe("listPlatformNotices", () => {
  it("reads the caller's newest hundred notices", async () => {
    const [notice] = await listPlatformNotices();

    expect(notice).toMatchObject({ id: 12, title: "Mantenimiento", action: null });
    expect(notices.calls).toContainEqual(["order", "created_at", { ascending: false }]);
    expect(notices.calls).toContainEqual(["limit", 100]);
  });

  it("reads as an empty inbox when the query fails", async () => {
    connect({ data: null, error: { message: "boom" } });

    await expect(listPlatformNotices()).resolves.toEqual([]);
  });
});

describe("fetchPlatformNotice", () => {
  it("reads one notice by its number", async () => {
    connect({ data: row, error: null });

    await expect(fetchPlatformNotice(12)).resolves.toMatchObject({ id: 12, kind: "announcement" });
    expect(notices.calls).toContainEqual(["eq", "id", 12]);
  });

  it("reads a notice that is not the caller's as missing", async () => {
    // Row-level security returns nothing for somebody else's notice.
    connect({ data: null, error: null });

    await expect(fetchPlatformNotice(12)).resolves.toBeNull();
  });
});

describe("administration's view", () => {
  it("counts each audience", async () => {
    rpc.mockResolvedValue({
      data: [
        { audience: "everyone", people: 214 },
        { audience: "sellers", people: 38 },
        { audience: "buyers", people: 176 },
      ],
      error: null,
    });

    await expect(getNoticeAudienceCounts()).resolves.toEqual({ everyone: 214, sellers: 38, buyers: 176 });
    expect(rpc).toHaveBeenCalledWith("platform_notice_audience_counts");
  });

  it("counts nobody when the counts cannot be read", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(getNoticeAudienceCounts()).resolves.toEqual({ everyone: 0, sellers: 0, buyers: 0 });
  });

  it("lists what was sent", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          batch_id: "b-1",
          audience: "person",
          recipient_label: "Ana Ruiz",
          title: "Sobre tu tienda",
          body: "Agrega una portada.",
          action_href: "/panel",
          action_label: "Ir a mi panel",
          recipient_count: 1,
          read_count: 1,
          created_at: "2026-10-12T16:42:00Z",
          retracted_at: null,
        },
      ],
      error: null,
    });

    const [batch] = await listNoticeBatches();

    expect(rpc).toHaveBeenCalledWith("list_platform_notice_batches");
    expect(batch).toMatchObject({
      id: "b-1",
      recipientLabel: "Ana Ruiz",
      readCount: 1,
      action: { href: "/panel", label: "Ir a mi panel" },
    });
  });
});
