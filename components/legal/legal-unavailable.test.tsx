import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LegalUnavailable } from "@/components/legal/legal-unavailable";

afterEach(cleanup);

const route = {
  type: "platform_terms" as const,
  path: "/terminos",
  navLabel: "Términos",
  title: "Términos y condiciones",
};

describe("LegalUnavailable", () => {
  it("names the document that is missing", () => {
    render(<LegalUnavailable route={route} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Términos y condiciones" }),
    ).toBeInTheDocument();
  });

  it("says plainly that no approved version is published", () => {
    render(<LegalUnavailable route={route} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Este documento aún no está disponible: no hay una versión aprobada y publicada.",
    );
  });

  it("does not claim purchase requests are blocked", () => {
    const { container } = render(<LegalUnavailable route={route} />);

    expect(container.textContent).not.toMatch(/no puede aceptar/i);
  });

  it("offers no control that could be read as acceptance", () => {
    render(<LegalUnavailable route={route} />);

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows no placeholder legal text", () => {
    const { container } = render(<LegalUnavailable route={route} />);

    expect(container.textContent).not.toMatch(/lorem|próximamente|pendiente de redacción/i);
  });
});
