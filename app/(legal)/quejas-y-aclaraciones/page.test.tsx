import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isSignedIn: vi.fn(),
  getPublishedLegalDocument: vi.fn(),
}));

vi.mock("@/lib/queries/contact.server", () => ({ isSignedIn: mocks.isSignedIn }));
vi.mock("@/lib/queries/legal.server", () => ({
  getPublishedLegalDocument: mocks.getPublishedLegalDocument,
}));
vi.mock("@/lib/actions/contact", () => ({ submitContactMessage: vi.fn() }));

const { default: Page } = await import("@/app/(legal)/quejas-y-aclaraciones/page");

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isSignedIn.mockResolvedValue(false);
  mocks.getPublishedLegalDocument.mockResolvedValue(null);
});

const contact = () => screen.getByRole("region", { name: "Escríbenos" });

describe("Quejas y aclaraciones", () => {
  it("offers a way to write even before the policy is published", async () => {
    render(await Page());

    expect(screen.getByText(/no hay una versión aprobada y publicada/i)).toBeInTheDocument();
    expect(within(contact()).getByRole("button", { name: "Enviar mensaje" })).toBeInTheDocument();
  });

  it("asks a visitor how to answer them", async () => {
    render(await Page());

    expect(within(contact()).getByLabelText("Correo electrónico")).toBeInTheDocument();
  });

  it("asks a signed-in person for the message alone", async () => {
    mocks.isSignedIn.mockResolvedValue(true);

    render(await Page());

    expect(within(contact()).queryByLabelText("Correo electrónico")).not.toBeInTheDocument();
    expect(within(contact()).getByLabelText("Mensaje", { exact: true })).toBeInTheDocument();
  });

  it("keeps the form below a published policy", async () => {
    mocks.getPublishedLegalDocument.mockResolvedValue({
      id: "v1", type: "complaints_policy", version: 1, title: "Quejas y aclaraciones",
      sections: [{ id: "canal", heading: "Canal de atención", paragraphs: ["Texto."] }],
      issuerIdentity: null, contentHash: "hash",
      effectiveAt: "2026-09-01T00:00:00.000Z", publishedAt: "2026-08-30T00:00:00.000Z",
    });

    render(await Page());

    const policy = screen.getByRole("heading", { level: 2, name: "Canal de atención" });
    const form = within(contact()).getByRole("button", { name: "Enviar mensaje" });
    expect(policy.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
