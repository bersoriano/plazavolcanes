import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShareActions } from "@/components/share/share-actions";

function setNavigatorProperty(name: "share" | "clipboard", value: unknown) {
  Object.defineProperty(navigator, name, {
    configurable: true,
    value,
  });
}

afterEach(() => {
  cleanup();
  setNavigatorProperty("share", undefined);
  setNavigatorProperty("clipboard", undefined);
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
});

describe("ShareActions", () => {
  it("shares current page through native share API", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigatorProperty("share", share);
    window.history.replaceState({}, "", "/productos/8");
    render(<ShareActions label="Compartir producto" title="Taza volcánica" />);

    fireEvent.click(screen.getByRole("button", { name: "Compartir" }));

    await waitFor(() => {
      expect(share).toHaveBeenCalledWith({
        title: "Taza volcánica",
        text: "Descubre Taza volcánica en Plaza Volcanes.",
        url: "http://localhost:3000/productos/8",
      });
    });
  });

  it("copies current page when native sharing is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigatorProperty("clipboard", { writeText });
    window.history.replaceState({}, "", "/tiendas/casa-niebla");
    render(<ShareActions label="Compartir tienda" title="Casa Niebla" />);

    fireEvent.click(screen.getByRole("button", { name: "Compartir" }));

    expect(await screen.findByText("Enlace copiado.")).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith("http://localhost:3000/tiendas/casa-niebla");
  });

  it("builds WhatsApp message from title and current page", async () => {
    window.history.replaceState({}, "", "/tiendas/casa-niebla");
    render(<ShareActions label="Compartir tienda" title="Casa Niebla" />);

    const link = screen.getByRole("link", { name: "Compartir por WhatsApp" });

    await waitFor(() => {
      expect(link).toHaveAttribute(
        "href",
        "https://wa.me/?text=Descubre%20Casa%20Niebla%20en%20Plaza%20Volcanes.%0Ahttp%3A%2F%2Flocalhost%3A3000%2Ftiendas%2Fcasa-niebla",
      );
    });
  });

  it("reports clipboard failures without claiming success", async () => {
    setNavigatorProperty("clipboard", {
      writeText: vi.fn().mockRejectedValue(new Error("blocked")),
    });
    render(<ShareActions label="Compartir producto" title="Taza volcánica" />);

    fireEvent.click(screen.getByRole("button", { name: "Compartir" }));

    expect(await screen.findByText("No pudimos copiar el enlace.")).toBeInTheDocument();
    expect(screen.queryByText("Enlace copiado.")).not.toBeInTheDocument();
  });
});
