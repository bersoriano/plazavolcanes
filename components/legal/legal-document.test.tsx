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
    expect(heading).toHaveAttribute("id", "seccion-arco");
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
    const docWithAllFields = {
      ...document,
      issuerIdentity: {
        entityName: "Ejemplo S.A. de C.V.",
        rfc: "EJE010101AB1",
        address: "Calle Falsa 123",
        email: "contacto@ejemplo.com",
        phone: "+52 55 1234 5678",
        attentionHours: "Lunes a viernes 9:00-17:00",
        privacyContact: "privacidad@ejemplo.com",
      },
    };

    render(<LegalDocument document={docWithAllFields} />);

    // All seven Spanish labels should render
    expect(screen.getByText("Razón social:")).toBeInTheDocument();
    expect(screen.getByText("RFC:")).toBeInTheDocument();
    expect(screen.getByText("Domicilio:")).toBeInTheDocument();
    expect(screen.getByText("Correo electrónico:")).toBeInTheDocument();
    expect(screen.getByText("Teléfono:")).toBeInTheDocument();
    expect(screen.getByText("Horario de atención:")).toBeInTheDocument();
    expect(screen.getByText("Contacto de datos personales:")).toBeInTheDocument();

    // Raw camelCase keys should NOT render
    expect(screen.queryByText("entityName:")).not.toBeInTheDocument();
    expect(screen.queryByText("rfc:")).not.toBeInTheDocument();
    expect(screen.queryByText("address:")).not.toBeInTheDocument();
    expect(screen.queryByText("email:")).not.toBeInTheDocument();
    expect(screen.queryByText("phone:")).not.toBeInTheDocument();
    expect(screen.queryByText("attentionHours:")).not.toBeInTheDocument();
    expect(screen.queryByText("privacyContact:")).not.toBeInTheDocument();
  });

  it("renders unknown identity fields with their raw keys as fallback", () => {
    const docWithUnknownField = {
      ...document,
      issuerIdentity: {
        entityName: "Ejemplo S.A. de C.V.",
        rfc: "EJE010101AB1",
        address: "Calle Falsa 123",
        customField: "Custom Value",
      },
    };

    render(<LegalDocument document={docWithUnknownField} />);

    // Known fields should use Spanish labels
    expect(screen.getByText("Razón social:")).toBeInTheDocument();
    expect(screen.getByText("RFC:")).toBeInTheDocument();
    expect(screen.getByText("Domicilio:")).toBeInTheDocument();

    // Unknown field should render with raw key
    expect(screen.getByText("customField:")).toBeInTheDocument();
    expect(screen.getByText("Custom Value")).toBeInTheDocument();
  });

  it("does not render identity section when issuerIdentity is empty object", () => {
    const docWithEmptyIdentity = {
      ...document,
      issuerIdentity: {},
    };

    render(<LegalDocument document={docWithEmptyIdentity} />);

    // The "Responsable de este documento" heading should not appear
    expect(
      screen.queryByRole("heading", { level: 2, name: "Responsable de este documento" }),
    ).not.toBeInTheDocument();
  });

  it("prevents id collisions between section ids and identity block id", () => {
    const docWithCollisionId = {
      ...document,
      sections: [
        { id: "responsable-identidad", heading: "A Section", paragraphs: ["Content."] },
      ],
      issuerIdentity: {
        entityName: "Ejemplo S.A. de C.V.",
        rfc: "EJE010101AB1",
        address: "Calle Falsa 123",
      },
    };

    render(<LegalDocument document={docWithCollisionId} />);

    const headings = screen.getAllByRole("heading", { level: 2 });
    const ids = headings.map((h) => h.id);

    // Section id should be prefixed, identity id should not
    expect(ids).toContain("seccion-responsable-identidad");
    expect(ids).toContain("responsable-identidad");
    // Both ids should be present and unique
    expect(new Set(ids).size).toBe(2);
  });
});
