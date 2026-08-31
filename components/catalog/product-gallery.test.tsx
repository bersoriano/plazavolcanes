import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProductGallery } from "@/components/catalog/product-gallery";

afterEach(cleanup);

const IMAGES = [
  "https://example.test/a.jpg",
  "https://example.test/b.jpg",
  "https://example.test/c.jpg",
];

function renderGallery(images = IMAGES) {
  return render(<ProductGallery images={images} name="Taza volcánica" />);
}

describe("ProductGallery", () => {
  it("shows the cover first and every image in the thumbnail strip", () => {
    renderGallery();

    expect(screen.getByTestId("gallery-active")).toHaveAttribute("src", IMAGES[0]);
    expect(screen.getByTestId("gallery-active")).toHaveAccessibleName("Taza volcánica");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Ver imagen 1" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("renders a placeholder when a product has no images", () => {
    renderGallery([]);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByTestId("gallery-placeholder")).toBeInTheDocument();
  });

  it("does not render a thumbnail strip for a single image", () => {
    renderGallery([IMAGES[0]]);

    expect(screen.getByTestId("gallery-active")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("swaps the big image when a thumbnail is chosen", () => {
    renderGallery();

    fireEvent.click(screen.getByRole("button", { name: "Ver imagen 3" }));

    expect(screen.getByTestId("gallery-active")).toHaveAttribute("src", IMAGES[2]);
    expect(screen.getByRole("button", { name: "Ver imagen 3" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: "Ver imagen 1" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("opens the chosen image full screen and closes it again", () => {
    renderGallery();

    fireEvent.click(screen.getByRole("button", { name: "Ver imagen 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Ampliar imagen" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByTestId("lightbox-image")).toHaveAttribute("src", IMAGES[1]);

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("walks the gallery from inside the overlay and wraps around", () => {
    renderGallery();

    fireEvent.click(screen.getByRole("button", { name: "Ampliar imagen" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(screen.getByTestId("lightbox-image")).toHaveAttribute("src", IMAGES[1]);

    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));

    expect(screen.getByTestId("lightbox-image")).toHaveAttribute("src", IMAGES[2]);
  });

  it("moves through the overlay with the arrow keys and closes on Escape", () => {
    renderGallery();

    fireEvent.click(screen.getByRole("button", { name: "Ampliar imagen" }));
    fireEvent.keyDown(window, { key: "ArrowRight" });

    expect(screen.getByTestId("lightbox-image")).toHaveAttribute("src", IMAGES[1]);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the overlay choice as the big image after it closes", () => {
    renderGallery();

    fireEvent.click(screen.getByRole("button", { name: "Ampliar imagen" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.getByTestId("gallery-active")).toHaveAttribute("src", IMAGES[1]);
  });

  it("leaves focus alone until the overlay has been used", () => {
    renderGallery();

    expect(screen.getByRole("button", { name: "Ampliar imagen" })).not.toHaveFocus();
  });

  it("frees the page scroll again once the overlay closes", () => {
    renderGallery();

    fireEvent.click(screen.getByRole("button", { name: "Ampliar imagen" }));
    expect(document.body).toHaveStyle({ overflow: "hidden" });

    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.body).not.toHaveStyle({ overflow: "hidden" });
  });

  it("offers no arrows for a single image", () => {
    renderGallery([IMAGES[0]]);

    fireEvent.click(screen.getByRole("button", { name: "Ampliar imagen" }));

    expect(screen.queryByRole("button", { name: "Siguiente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Anterior" })).not.toBeInTheDocument();
  });
});
