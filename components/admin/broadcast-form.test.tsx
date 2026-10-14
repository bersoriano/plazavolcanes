import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BroadcastForm } from "@/components/admin/broadcast-form";

const { sendNotice } = vi.hoisted(() => ({ sendNotice: vi.fn() }));

vi.mock("@/lib/actions/platform-notices", () => ({ sendNotice }));

const counts = { everyone: 214, sellers: 38, buyers: 1 };

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sendNotice).mockResolvedValue({
    status: "success",
    message: "Anuncio enviado a 214 personas.",
  });
});

function write() {
  fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Mantenimiento" } });
  fireEvent.change(screen.getByLabelText("Mensaje"), { target: { value: "El sábado por la noche." } });
}

const ask = () => fireEvent.click(screen.getByRole("button", { name: "Enviar anuncio" }));

describe("BroadcastForm", () => {
  it("offers the three audiences with how many people each reaches", () => {
    render(<BroadcastForm counts={counts} />);

    expect(screen.getByRole("radio", { name: /Todas las personas.*214/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Quienes venden.*38/ })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: /Quienes solo compran.*1/ })).not.toBeChecked();
  });

  it("does not send on the first press: it says how many people it will reach", () => {
    render(<BroadcastForm counts={counts} />);
    write();
    ask();

    expect(sendNotice).not.toHaveBeenCalled();
    expect(screen.getByText(/Se enviará a 214 personas\./)).toBeInTheDocument();
    expect(screen.getByText(/No se puede editar después/)).toBeInTheDocument();
  });

  it("asks for the title and the message before asking for confirmation", () => {
    render(<BroadcastForm counts={counts} />);
    ask();

    expect(screen.queryByText(/Se enviará a/)).not.toBeInTheDocument();
  });

  it("confirms with the count of the audience that was chosen", () => {
    render(<BroadcastForm counts={counts} />);
    write();
    fireEvent.click(screen.getByRole("radio", { name: /Quienes venden/ }));
    ask();

    expect(screen.getByText(/Se enviará a 38 personas\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar a 38 personas" })).toBeInTheDocument();
  });

  it("counts one person in the singular", () => {
    render(<BroadcastForm counts={counts} />);
    write();
    fireEvent.click(screen.getByRole("radio", { name: /Quienes solo compran/ }));
    ask();

    expect(screen.getByRole("button", { name: "Enviar a 1 persona" })).toBeInTheDocument();
  });

  it("sends to the chosen audience once confirmed", async () => {
    render(<BroadcastForm counts={counts} />);
    write();
    fireEvent.click(screen.getByRole("radio", { name: /Quienes venden/ }));
    ask();
    fireEvent.click(screen.getByRole("button", { name: "Enviar a 38 personas" }));

    await waitFor(() => expect(sendNotice).toHaveBeenCalledTimes(1));
    const submitted = vi.mocked(sendNotice).mock.calls[0]?.[1] as FormData;
    expect(submitted.get("audience")).toBe("sellers");
    expect(submitted.get("title")).toBe("Mantenimiento");
    expect(submitted.get("recipient_id")).toBeNull();
  });

  it("can step back from the confirmation without sending", () => {
    render(<BroadcastForm counts={counts} />);
    write();
    ask();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByText(/Se enviará a/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toHaveValue("Mantenimiento");
    expect(sendNotice).not.toHaveBeenCalled();
  });

  it("says how it went and leaves the confirmation behind", async () => {
    render(<BroadcastForm counts={counts} />);
    write();
    ask();
    fireEvent.click(screen.getByRole("button", { name: "Enviar a 214 personas" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Anuncio enviado a 214 personas.");
    expect(screen.queryByText(/Se enviará a/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar anuncio" })).toBeInTheDocument();
  });

  it("keeps what was typed when the announcement is refused", async () => {
    vi.mocked(sendNotice).mockResolvedValue({ status: "error", message: "No pudimos enviar el aviso." });
    render(<BroadcastForm counts={counts} />);
    write();
    ask();
    fireEvent.click(screen.getByRole("button", { name: "Enviar a 214 personas" }));

    expect(await screen.findByRole("status")).toHaveTextContent("No pudimos enviar el aviso.");
    expect(screen.getByLabelText("Mensaje")).toHaveValue("El sábado por la noche.");
  });
});
