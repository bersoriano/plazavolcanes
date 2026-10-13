import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UserAccountControls } from "@/components/admin/user-account-controls";
import type { AdminMarketplaceUser } from "@/lib/queries/admin";

const { deleteUser, setUserDisabled } = vi.hoisted(() => ({
  deleteUser: vi.fn(),
  setUserDisabled: vi.fn(),
}));

vi.mock("@/lib/actions/admin-users", () => ({ deleteUser, setUserDisabled }));

const lucia: AdminMarketplaceUser = {
  id: "persona-1",
  email: "lucia@tallervolcan.mx",
  displayName: "Lucía Martínez",
  createdAt: "2026-08-01T00:00:00.000Z",
  shopLimit: 1,
  isDisabled: false,
  isAdmin: false,
  shops: [],
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(setUserDisabled).mockResolvedValue({ status: "idle", message: "" });
  vi.mocked(deleteUser).mockResolvedValue({ status: "idle", message: "" });
});

describe("UserAccountControls", () => {
  it("offers no account actions on an administrator account", () => {
    render(<UserAccountControls user={{ ...lucia, isAdmin: true }} />);

    expect(screen.getByText("Cuenta de administración")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("disables an enabled account", async () => {
    vi.mocked(setUserDisabled).mockResolvedValueOnce({
      status: "success",
      message: "Cuenta deshabilitada.",
      values: { disabled: "true" },
    });

    render(<UserAccountControls user={lucia} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Deshabilitar cuenta de Lucía Martínez" }),
    );

    await waitFor(() => expect(setUserDisabled).toHaveBeenCalledOnce());
    const submitted = vi.mocked(setUserDisabled).mock.calls[0]?.[1];
    expect(submitted?.get("user_id")).toBe("persona-1");
    expect(submitted?.get("disabled")).toBe("true");
    expect(await screen.findByRole("status")).toHaveTextContent("Cuenta deshabilitada.");
    expect(
      screen.getByRole("button", { name: "Habilitar cuenta de Lucía Martínez" }),
    ).toBeInTheDocument();
  });

  it("enables a disabled account", async () => {
    render(<UserAccountControls user={{ ...lucia, isDisabled: true }} />);

    fireEvent.click(screen.getByRole("button", { name: "Habilitar cuenta de Lucía Martínez" }));

    await waitFor(() => expect(setUserDisabled).toHaveBeenCalledOnce());
    expect(vi.mocked(setUserDisabled).mock.calls[0]?.[1].get("disabled")).toBe("false");
  });

  it("announces a refusal returned by the server", async () => {
    vi.mocked(setUserDisabled).mockResolvedValueOnce({
      status: "error",
      message: "No pudimos actualizar la cuenta.",
    });

    render(<UserAccountControls user={lucia} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Deshabilitar cuenta de Lucía Martínez" }),
    );

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("No pudimos actualizar la cuenta.");
    expect(status).toHaveClass("text-sale");
  });

  it("deletes only after the account's email is typed", async () => {
    render(<UserAccountControls user={lucia} />);

    fireEvent.click(screen.getByRole("button", { name: "Eliminar cuenta de Lucía Martínez" }));
    expect(deleteUser).not.toHaveBeenCalled();

    const confirm = screen.getByRole("button", { name: "Eliminar definitivamente" });
    const input = screen.getByRole("textbox", {
      name: "Escribe lucia@tallervolcan.mx para confirmar",
    });
    expect(confirm).toBeDisabled();

    fireEvent.change(input, { target: { value: "lucia@tallervolcan" } });
    expect(confirm).toBeDisabled();

    fireEvent.change(input, { target: { value: "lucia@tallervolcan.mx" } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(deleteUser).toHaveBeenCalledOnce());
    expect(vi.mocked(deleteUser).mock.calls[0]?.[1].get("user_id")).toBe("persona-1");
  });

  it("asks for a fixed word when the account has no email", () => {
    render(<UserAccountControls user={{ ...lucia, email: null, displayName: null }} />);

    fireEvent.click(screen.getByRole("button", { name: "Eliminar cuenta de cuenta sin nombre" }));

    const input = screen.getByRole("textbox", { name: "Escribe ELIMINAR para confirmar" });
    fireEvent.change(input, { target: { value: "ELIMINAR" } });
    expect(screen.getByRole("button", { name: "Eliminar definitivamente" })).toBeEnabled();
  });

  it("closes the confirmation and forgets what was typed on cancel", () => {
    render(<UserAccountControls user={lucia} />);

    fireEvent.click(screen.getByRole("button", { name: "Eliminar cuenta de Lucía Martínez" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "lucia@tallervolcan.mx" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar cuenta de Lucía Martínez" }));
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Eliminar definitivamente" })).toBeDisabled();
  });

  it("explains why an account with history was not deleted", async () => {
    vi.mocked(deleteUser).mockResolvedValueOnce({
      status: "error",
      message:
        "Esta cuenta tiene historial de pedidos o conversaciones. Deshabilítala en lugar de eliminarla.",
    });

    render(<UserAccountControls user={lucia} />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar cuenta de Lucía Martínez" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "lucia@tallervolcan.mx" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Eliminar definitivamente" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Deshabilítala en lugar de eliminarla.");
    expect(status).toHaveClass("text-sale");
  });
});
