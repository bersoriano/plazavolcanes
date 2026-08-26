import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LegalDocument } from "@/components/legal/legal-document";

afterEach(cleanup);

const document = {
  id: "b1",
  type: "privacy_notice" as const,
  version: 2,
  title: "Aviso de privacidad",
  sections: [
    { id: "responsable", heading: "Responsable", paragraphs: ["Primer párrafo.", "Segundo."] },
    { id: "arco", heading: "Derechos ARCO", paragraphs: ["Cómo ejercerlos."] },
  ],
  issuerIdentity: {
    entityName: "Ejemplo S.A. de C.V.",
    rfc: "EJE010101AB1",
    address: "Calle Falsa 123",
  },
  contentHash: "abc123def456",
  effectiveAt: "2026-09-01T00:00:00.000Z",
  publishedAt: "2026-08-30T00:00:00.000Z",
};

describe("LegalDocument", () => {
  it("renders the title as the page heading", () => {
    render(<LegalDocument document={document} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Aviso de privacidad" }),
    ).toBeInTheDocument();
  });

  it("gives every section a linkable heading", () => {
    render(<LegalDocument document={document} />);

    const heading = screen.getByRole("heading", { level: 2, name: "Derechos ARCO" });
    expect(heading).toHaveAttribute("id", "arco");
  });

  it("renders every paragraph", () => {
    render(<LegalDocument document={document} />);

    expect(screen.getByText("Primer párrafo.")).toBeInTheDocument();
    expect(screen.getByText("Segundo.")).toBeInTheDocument();
  });

  it("shows the issuer identity the version was published with", () => {
    render(<LegalDocument document={document} />);

    expect(screen.getByText(/Ejemplo S\.A\. de C\.V\./)).toBeInTheDocument();
    expect(screen.getByText(/EJE010101AB1/)).toBeInTheDocument();
  });

  it("states the version and its content hash so a person can cite it", () => {
    render(<LegalDocument document={document} />);

    expect(screen.getByText(/Versión 2/)).toBeInTheDocument();
    expect(screen.getByText(/abc123def456/)).toBeInTheDocument();
  });

  it("renders known identity fields with Spanish labels, not camelCase keys", () => {
    render(<LegalDocument document={document} />);

    // Should render Spanish label
    expect(screen.getByText("Razón social:")).toBeInTheDocument();
    // Should NOT render the raw camelCase key
    expect(screen.queryByText("entityName:")).not.toBeInTheDocument();

    // Should render RFC label
    expect(screen.getByText("RFC:")).toBeInTheDocument();
    expect(screen.queryByText("rfc:")).not.toBeInTheDocument();

    // Should render Domicilio label
    expect(screen.getByText("Domicilio:")).toBeInTheDocument();
    expect(screen.queryByText("address:")).not.toBeInTheDocument();
  });
});
