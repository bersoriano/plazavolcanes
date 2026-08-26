import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CatalogImage } from "@/components/catalog/catalog-image";

describe("CatalogImage", () => {
  it("replaces a failed image with its fallback", () => {
    render(
      <CatalogImage
        alt="Taza volcánica"
        className="object-cover"
        fallback={<span>Imagen no disponible</span>}
        src="https://example.com/taza.jpg"
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Taza volcánica" }));

    expect(screen.queryByRole("img", { name: "Taza volcánica" })).not.toBeInTheDocument();
    expect(screen.getByText("Imagen no disponible")).toBeInTheDocument();
  });
});
