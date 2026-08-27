import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getPublishedLegalDocument = vi.fn();

vi.mock("@/lib/queries/legal.server", () => ({ getPublishedLegalDocument }));

afterEach(() => {
  cleanup();
  getPublishedLegalDocument.mockReset();
});

describe("LegalRoutePage", () => {
  it("renders the unavailable notice when nothing is published", async () => {
    getPublishedLegalDocument.mockResolvedValue(null);
    const { LegalRoutePage } = await import("@/app/(legal)/legal-route");

    render(await LegalRoutePage({ type: "platform_terms" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      /no hay una versión aprobada y publicada/i,
    );
  });

  it("renders the document when one is published", async () => {
    getPublishedLegalDocument.mockResolvedValue({
      id: "b1", type: "platform_terms", version: 1, title: "Términos y condiciones",
      sections: [{ id: "objeto", heading: "Objeto", paragraphs: ["Texto."] }],
      issuerIdentity: null, contentHash: "hash",
      effectiveAt: "2026-09-01T00:00:00.000Z", publishedAt: "2026-08-30T00:00:00.000Z",
    });
    const { LegalRoutePage } = await import("@/app/(legal)/legal-route");

    render(await LegalRoutePage({ type: "platform_terms" }));

    expect(screen.getByRole("heading", { level: 2, name: "Objeto" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("keeps an unpublished document out of search results", async () => {
    getPublishedLegalDocument.mockResolvedValue(null);
    const { buildLegalMetadata } = await import("@/app/(legal)/legal-route");

    const metadata = await buildLegalMetadata("platform_terms");

    expect(metadata.robots).toMatchObject({ index: false });
  });

  it("indexes a published document", async () => {
    getPublishedLegalDocument.mockResolvedValue({
      id: "b1", type: "platform_terms", version: 1, title: "Términos y condiciones",
      sections: [], issuerIdentity: null, contentHash: "hash",
      effectiveAt: "2026-09-01T00:00:00.000Z", publishedAt: "2026-08-30T00:00:00.000Z",
    });
    const { buildLegalMetadata } = await import("@/app/(legal)/legal-route");

    const metadata = await buildLegalMetadata("platform_terms");

    expect(metadata.title).toBe("Términos y condiciones");
    expect(metadata.robots).toBeUndefined();
  });
});
