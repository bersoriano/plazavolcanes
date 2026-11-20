import { act, renderHook } from "@testing-library/react";
import { redirect } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ActionState } from "@/lib/action-state";
import { initialActionState } from "@/lib/action-state";

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@/lib/analytics.client", () => ({ track }));

import { trackFormAction, useFormStart } from "@/lib/analytics-forms";

afterEach(() => {
  vi.clearAllMocks();
});

const resolves = (result: ActionState) => vi.fn(async () => result);

describe("trackFormAction", () => {
  it("reports the attempt, then the lead once the server confirms it", async () => {
    const action = resolves({ status: "success", message: "Recibido." });
    const tracked = trackFormAction(action, "contact", "generate_lead");

    await expect(tracked(initialActionState, new FormData())).resolves.toEqual({ status: "success", message: "Recibido." });

    expect(track.mock.calls).toEqual([
      ["form_submit", { form_name: "contact" }],
      ["generate_lead", { form_name: "contact" }],
    ]);
  });

  it("reports a confirmed account as sign_up by email", async () => {
    const tracked = trackFormAction(resolves({ status: "success", message: "Revisa tu correo." }), "seller_signup", "sign_up");

    await tracked(initialActionState, new FormData());

    expect(track).toHaveBeenLastCalledWith("sign_up", { method: "email", form_name: "seller_signup" });
  });

  it("treats the server's redirect as confirmation and lets it through", async () => {
    const action = vi.fn(async (): Promise<ActionState> => redirect("/panel/tiendas/nueva"));
    const tracked = trackFormAction(action, "signup", "sign_up");

    const failure = await tracked(initialActionState, new FormData()).catch((error: unknown) => error);

    expect(failure).toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    expect(track.mock.calls).toEqual([
      ["form_submit", { form_name: "signup" }],
      ["sign_up", { method: "email", form_name: "signup" }],
    ]);
  });

  it.each([
    [{ status: "error", message: "Revisa los campos marcados.", errors: { email: ["Correo inválido"] } }, "validation"],
    [{ status: "error", message: "No pudimos crear la cuenta." }, "server"],
  ] satisfies [ActionState, string][])("reports a refused submit as a %s error, never as a conversion", async (result, errorType) => {
    await trackFormAction(resolves(result), "signup", "sign_up")(initialActionState, new FormData());

    expect(track).toHaveBeenLastCalledWith("form_error", { form_name: "signup", error_type: errorType });
    expect(track).not.toHaveBeenCalledWith("sign_up", expect.anything());
  });

  it("reports a failed request as a network error and rethrows it", async () => {
    const offline = new TypeError("Failed to fetch");
    const tracked = trackFormAction(vi.fn(async () => { throw offline; }), "contact", "generate_lead");

    await expect(tracked(initialActionState, new FormData())).rejects.toBe(offline);

    expect(track).toHaveBeenLastCalledWith("form_error", { form_name: "contact", error_type: "network" });
    expect(track).not.toHaveBeenCalledWith("generate_lead", expect.anything());
  });

  it("never sends what the person typed", async () => {
    const formData = new FormData();
    formData.set("email", "ana@example.com");
    formData.set("message", "Mi pedido 123");

    await trackFormAction(resolves({ status: "success", message: "" }), "contact", "generate_lead")(initialActionState, formData);

    expect(JSON.stringify(track.mock.calls)).not.toMatch(/ana@example|pedido/);
  });
});

describe("useFormStart", () => {
  it("reports the first interaction with a form once", () => {
    const { result } = renderHook(() => useFormStart("contact"));

    act(() => {
      result.current();
      result.current();
    });

    expect(track.mock.calls).toEqual([["form_start", { form_name: "contact" }]]);
  });
});
