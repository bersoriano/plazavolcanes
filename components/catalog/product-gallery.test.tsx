import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProductGallery } from "@/components/catalog/product-gallery";

afterEach(cleanup);

describe("ProductGallery", () => {
  it("shows the cover first and every other image after it", () => {
    render(
      <ProductGallery
        images={[
          "https://example.test/a.jpg",
          "https://example.test/b.jpg",
          "https://example.test/c.jpg",
        ]}
        name="Taza volcánica"
      />,
    );

    const images = screen.getAllByRole("img");

    expect(images).toHaveLength(3);
    expect(images[0]).toHaveAttribute("src", "https://example.test/a.jpg");
    expect(images[0]).toHaveAccessibleName("Taza volcánica");
    expect(images[1]).toHaveAccessibleName("Taza volcánica, imagen 2");
  });

  it("renders a placeholder when a product has no images", () => {
    render(<ProductGallery images={[]} name="Taza volcánica" />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByTestId("gallery-placeholder")).toBeInTheDocument();
  });

  it("does not render a thumbnail strip for a single image", () => {
    render(<ProductGallery images={["https://example.test/a.jpg"]} name="Taza" />);

    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
