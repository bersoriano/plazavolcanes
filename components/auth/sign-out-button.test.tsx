import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SignOutButton } from "@/components/auth/sign-out-button";

vi.mock("@/lib/actions/auth", () => ({ signOut: vi.fn() }));

afterEach(cleanup);

describe("SignOutButton", () => {
  it("keeps an accessible name when compact label is hidden", () => {
    render(<SignOutButton />);

    const button = screen.getByRole("button", { name: "Salir" });

    expect(button).toHaveAttribute("aria-label", "Salir");
  });
});
