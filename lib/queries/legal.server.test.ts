import { afterEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ rpc }),
}));

vi.mock("@/lib/supabase/config", () => ({
  isSupabaseConfigured: () => true,
}));

afterEach(() => {
  rpc.mockReset();
});

describe("getPublishedLegalDocument", () => {
  it("returns null when nothing is published", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const { getPublishedLegalDocument } = await import("@/lib/queries/legal.server");

    await expect(getPublishedLegalDocument("platform_terms")).resolves.toBeNull();
  });

  it("returns null when the query errors rather than throwing into a page", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { getPublishedLegalDocument } = await import("@/lib/queries/legal.server");

    await expect(getPublishedLegalDocument("platform_terms")).resolves.toBeNull();
  });

  it("maps a published row onto the document shape", async () => {
    rpc.mockResolvedValue({
      data: {
        id: "b0000000-0000-4000-8000-000000000002",
        document_type: "privacy_notice",
        version: 3,
        title: "Aviso de privacidad",
        body: { sections: [{ id: "responsable", heading: "Responsable", paragraphs: ["Uno."] }] },
        issuer_identity: { rfc: "EJE010101AB1" },
        content_hash: "abc123",
        effective_at: "2026-09-01T00:00:00.000Z",
        published_at: "2026-08-30T00:00:00.000Z",
      },
      error: null,
    });
    const { getPublishedLegalDocument } = await import("@/lib/queries/legal.server");

    const doc = await getPublishedLegalDocument("privacy_notice");

    expect(doc?.version).toBe(3);
    expect(doc?.sections).toHaveLength(1);
    expect(doc?.sections[0].heading).toBe("Responsable");
    expect(doc?.contentHash).toBe("abc123");
  });

  it("tolerates a body with no sections array", async () => {
    rpc.mockResolvedValue({
      data: {
        id: "b1", document_type: "platform_terms", version: 1, title: "Términos",
        body: {}, issuer_identity: null, content_hash: "h",
        effective_at: "2026-09-01T00:00:00.000Z", published_at: "2026-08-30T00:00:00.000Z",
      },
      error: null,
    });
    const { getPublishedLegalDocument } = await import("@/lib/queries/legal.server");

    await expect(getPublishedLegalDocument("platform_terms")).resolves.toMatchObject({
      sections: [],
    });
  });
});
