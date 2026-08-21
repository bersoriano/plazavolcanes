import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PhoneForm } from "@/components/account/phone-form";
import type { ActionState } from "@/lib/action-state";

const action = async (): Promise<ActionState> => ({ status: "idle", message: "" });

afterEach(cleanup);

describe("PhoneForm", () => {
  it("shows the stored number as ten digits without the country code", () => {
    render(<PhoneForm action={action} phone="+523312345678" />);

    expect(screen.getByLabelText("Teléfono móvil")).toHaveValue("3312345678");
  });

  it("starts empty for an account that never gave one", () => {
    render(<PhoneForm action={action} phone={null} />);

    expect(screen.getByLabelText("Teléfono móvil")).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Agrega tu teléfono móvil para completar tu cuenta.",
    );
  });
});
