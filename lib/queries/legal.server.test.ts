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

const validRow = {
  id: "b0000000-0000-4000-8000-000000000001",
  document_type: "platform_terms",
  version: 1,
  title: "Términos",
  body: {},
  issuer_identity: null,
  content_hash: "h",
  effective_at: "2026-09-01T00:00:00.000Z",
  published_at: "2026-08-30T00:00:00.000Z",
};

describe("getPublishedLegalDocument", () => {
  it("returns null when nothing is published", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const { getPublishedLegalDocument } = await import("@/lib/queries/legal.server");

    await expect(getPublishedLegalDocument("platform_terms")).resolves.toBeNull();
  });

  it("returns null when the query errors even with a valid row present", async () => {
    rpc.mockResolvedValue({ data: validRow, error: { message: "boom" } });
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

  it("returns null when version is not a positive integer", async () => {
    const { getPublishedLegalDocument } = await import("@/lib/queries/legal.server");

    const testCases = [
      { version: "not a number" },
      { version: 0 },
      { version: -1 },
      { version: 1.5 },
      { version: NaN },
    ];

    for (const testCase of testCases) {
      rpc.mockResolvedValue({
        data: { ...validRow, version: testCase.version },
        error: null,
      });

      await expect(getPublishedLegalDocument("platform_terms")).resolves.toBeNull();
    }
  });

  describe("malformed sections handling", () => {
    const baseRow = {
      id: "b2",
      document_type: "platform_terms",
      version: 1,
      title: "Test",
      issuer_identity: null,
      content_hash: "h",
      effective_at: "2026-09-01T00:00:00.000Z",
      published_at: "2026-08-30T00:00:00.000Z",
    };

    const testCases = [
      {
        name: "sections is not an array",
        body: { sections: "not an array" },
        expectedSections: [],
      },
      {
        name: "sections is null",
        body: { sections: null },
        expectedSections: [],
      },
      {
        name: "sections contains null entry",
        body: { sections: [null] },
        expectedSections: [],
      },
      {
        name: "sections contains string entry",
        body: { sections: ["not an object"] },
        expectedSections: [],
      },
      {
        name: "section entry missing id",
        body: { sections: [{ heading: "Title", paragraphs: [] }] },
        expectedSections: [],
      },
      {
        name: "section entry with non-string id",
        body: { sections: [{ id: 123, heading: "Title", paragraphs: [] }] },
        expectedSections: [],
      },
      {
        name: "section entry missing heading",
        body: { sections: [{ id: "s1", paragraphs: [] }] },
        expectedSections: [],
      },
      {
        name: "section entry with non-string heading",
        body: { sections: [{ id: "s1", heading: 456, paragraphs: [] }] },
        expectedSections: [],
      },
      {
        name: "section entry missing paragraphs",
        body: { sections: [{ id: "s1", heading: "Title" }] },
        expectedSections: [{ id: "s1", heading: "Title", paragraphs: [] }],
      },
      {
        name: "section entry with non-array paragraphs",
        body: { sections: [{ id: "s1", heading: "Title", paragraphs: "text" }] },
        expectedSections: [{ id: "s1", heading: "Title", paragraphs: [] }],
      },
      {
        name: "paragraphs containing non-strings",
        body: { sections: [{ id: "s1", heading: "Title", paragraphs: ["valid", 123, null, true] }] },
        expectedSections: [{ id: "s1", heading: "Title", paragraphs: ["valid"] }],
      },
      {
        name: "valid section with all fields",
        body: { sections: [{ id: "s1", heading: "Title", paragraphs: ["Para 1", "Para 2"] }] },
        expectedSections: [{ id: "s1", heading: "Title", paragraphs: ["Para 1", "Para 2"] }],
      },
    ];

    for (const testCase of testCases) {
      it(testCase.name, async () => {
        rpc.mockResolvedValue({
          data: { ...baseRow, body: testCase.body },
          error: null,
        });
        const { getPublishedLegalDocument } = await import("@/lib/queries/legal.server");

        const doc = await getPublishedLegalDocument("platform_terms");

        expect(doc?.sections).toEqual(testCase.expectedSections);
      });
    }
  });
});
