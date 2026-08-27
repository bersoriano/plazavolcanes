import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CatalogImage } from "@/components/catalog/catalog-image";

afterEach(cleanup);

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

  it("replaces an image that completed broken before its error handler attached", async () => {
    const complete = vi
      .spyOn(HTMLImageElement.prototype, "complete", "get")
      .mockReturnValue(true);
    const naturalWidth = vi
      .spyOn(HTMLImageElement.prototype, "naturalWidth", "get")
      .mockReturnValue(0);

    try {
      render(
        <CatalogImage
          alt="Taza volcánica"
          className="object-cover"
          fallback={<span>Imagen no disponible</span>}
          src="https://example.com/rota.jpg"
        />,
      );

      await waitFor(() =>
        expect(screen.queryByRole("img", { name: "Taza volcánica" })).not.toBeInTheDocument(),
      );
      expect(screen.getByText("Imagen no disponible")).toBeInTheDocument();
    } finally {
      complete.mockRestore();
      naturalWidth.mockRestore();
    }
  });

  it("tries a new source after the previous source failed", () => {
    const { rerender } = render(
      <CatalogImage
        alt="Taza volcánica"
        className="object-cover"
        fallback={<span>Imagen no disponible</span>}
        src="https://example.com/rota.jpg"
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Taza volcánica" }));
    rerender(
      <CatalogImage
        alt="Taza volcánica"
        className="object-cover"
        fallback={<span>Imagen no disponible</span>}
        src="https://example.com/nueva.jpg"
      />,
    );

    expect(screen.getByRole("img", { name: "Taza volcánica" })).toHaveAttribute(
      "src",
      "https://example.com/nueva.jpg",
    );
    expect(screen.queryByText("Imagen no disponible")).not.toBeInTheDocument();
  });

  it("retries a source after it is removed and restored", () => {
    const props = {
      alt: "Taza volcánica",
      className: "object-cover",
      fallback: <span>Imagen no disponible</span>,
    };
    const { rerender } = render(
      <CatalogImage {...props} src="https://example.com/rota.jpg" />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Taza volcánica" }));
    rerender(<CatalogImage {...props} src={null} />);
    rerender(<CatalogImage {...props} src="https://example.com/rota.jpg" />);

    expect(screen.getByRole("img", { name: "Taza volcánica" })).toHaveAttribute(
      "src",
      "https://example.com/rota.jpg",
    );
  });
});
