import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EmailNotificationsForm } from "@/components/account/email-notifications-form";
import type { ActionState } from "@/lib/action-state";

const action = async (): Promise<ActionState> => ({ status: "idle", message: "" });

afterEach(cleanup);

describe("EmailNotificationsForm", () => {
  it("starts switched on and says where the emails go", () => {
    render(<EmailNotificationsForm action={action} email="tienda@example.com" enabled />);

    expect(screen.getByRole("checkbox", { name: /Avísame por correo/ })).toBeChecked();
    expect(screen.getByText(/tienda@example\.com/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar avisos" })).toBeInTheDocument();
  });

  it("shows a seller who switched them off as off", () => {
    render(<EmailNotificationsForm action={action} email={null} enabled={false} />);

    expect(screen.getByRole("checkbox", { name: /Avísame por correo/ })).not.toBeChecked();
  });
});
