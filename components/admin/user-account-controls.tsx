"use client";

import { useState } from "react";

import { deleteUser, setUserDisabled } from "@/lib/actions/admin-users";
import type { ActionState } from "@/lib/action-state";
import type { AdminMarketplaceUser } from "@/lib/queries/admin";
import { useFormAction } from "@/lib/use-form-action";

function ActionMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;

  return (
    <p
      className={`w-full text-sm ${state.status === "error" ? "text-sale" : "text-success"}`}
      role="status"
    >
      {state.message}
    </p>
  );
}

function DisableAccount({ user, labelName }: { user: AdminMarketplaceUser; labelName: string }) {
  const [state, formAction, pending] = useFormAction(setUserDisabled);
  const appliedValue = state.status === "success" ? state.values?.disabled : undefined;
  const isDisabled =
    appliedValue === "true" ? true : appliedValue === "false" ? false : user.isDisabled;

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input name="user_id" type="hidden" value={user.id} />
      <button
        className="min-h-11 rounded-full border border-line bg-surface px-5 text-sm font-semibold disabled:opacity-60"
        disabled={pending}
        name="disabled"
        type="submit"
        value={String(!isDisabled)}
      >
        {isDisabled ? "Habilitar cuenta" : "Deshabilitar cuenta"}{" "}
        <span className="sr-only">de {labelName}</span>
      </button>
      <p className="min-w-48 flex-1 text-sm text-muted">
        {isDisabled
          ? "La cuenta no puede ingresar y sus tiendas quedaron pendientes de aprobación."
          : "Deshabilitar cierra sus sesiones, impide que ingrese y oculta sus tiendas."}
      </p>
      <ActionMessage state={state} />
    </form>
  );
}

function DeleteAccount({ user, labelName }: { user: AdminMarketplaceUser; labelName: string }) {
  const [state, formAction, pending] = useFormAction(deleteUser);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  // Typing the address proves the administrator is looking at the right card.
  const phrase = user.email ?? "ELIMINAR";
  const matches = typed.trim().toLowerCase() === phrase.toLowerCase();
  const inputId = `delete-account-${user.id}`;

  if (!confirming) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="min-h-11 rounded-full border border-sale/40 bg-surface px-5 text-sm font-semibold text-sale"
          onClick={() => setConfirming(true)}
          type="button"
        >
          Eliminar cuenta <span className="sr-only">de {labelName}</span>
        </button>
        <ActionMessage state={state} />
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-2xl border border-sale/40 bg-surface p-4">
      <input name="user_id" type="hidden" value={user.id} />
      <p className="text-sm font-semibold text-sale">Esta acción es permanente.</p>
      <p className="text-sm text-muted">
        Se eliminarán la cuenta, sus tiendas, sus publicaciones y sus imágenes. Una cuenta con
        pedidos o conversaciones no se puede eliminar; deshabilítala.
      </p>
      <div className="space-y-2">
        <label className="block text-sm font-semibold" htmlFor={inputId}>
          Escribe {phrase} para confirmar
        </label>
        <input
          autoComplete="off"
          className="min-h-11 w-full rounded-xl border border-line bg-background px-3 text-ink focus:border-brand focus:outline-none"
          id={inputId}
          onChange={(event) => setTyped(event.target.value)}
          spellCheck={false}
          type="text"
          value={typed}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          className="min-h-11 rounded-full bg-sale px-5 text-sm font-semibold text-white disabled:opacity-60"
          disabled={pending || !matches}
          type="submit"
        >
          {pending ? "Eliminando…" : "Eliminar definitivamente"}
        </button>
        <button
          className="min-h-11 rounded-full border border-line px-5 text-sm font-semibold"
          disabled={pending}
          onClick={() => {
            setConfirming(false);
            setTyped("");
          }}
          type="button"
        >
          Cancelar
        </button>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

export function UserAccountControls({ user }: { user: AdminMarketplaceUser }) {
  if (user.isAdmin) {
    return (
      <p className="mt-5 rounded-2xl border border-line bg-background p-4 text-sm text-muted">
        Cuenta de administración
      </p>
    );
  }

  const labelName = user.displayName ?? user.email ?? "cuenta sin nombre";

  return (
    <div className="mt-5 space-y-4 rounded-2xl border border-line bg-background p-4">
      <DisableAccount labelName={labelName} user={user} />
      <DeleteAccount labelName={labelName} user={user} />
    </div>
  );
}
