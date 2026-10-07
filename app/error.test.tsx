import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PlazaError from "@/app/error";

afterEach(cleanup);

describe("PlazaError", () => {
  it("says the plaza could not load instead of claiming it is empty, and retries", () => {
    const retry = vi.fn();
    render(<PlazaError error={new Error("Catalogue products failed (42703)")} retry={retry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar la plaza");
    expect(screen.queryByText(/42703/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
