"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import type { ActionState } from "@/lib/action-state";
import type { PickupPoint } from "@/lib/queries/checkout";
import { MEXICO_ADMINISTRATIVE_AREAS } from "@/lib/shop-location";
import { useFormAction } from "@/lib/use-form-action";
import { Field } from "@/components/ui/field";

type Method = "pickup" | "shipping" | null;

function areaName(code: string) {
  return MEXICO_ADMINISTRATIVE_AREAS.find((area) => area.code === code)?.label ?? code;
}

function ConfirmButton({ chosen }: { chosen: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="w-full rounded-full bg-brand px-6 py-3 font-semibold text-white disabled:opacity-60"
      disabled={pending || !chosen}
      type="submit"
    >
      {pending ? "Creando pedido…" : "Confirmar solicitud"}
    </button>
  );
}

/**
 * How the buyer will get what they are asking for.
 *
 * Neither option starts chosen: a preselected default is an answer the buyer did
 * not give, and this one decides whether a stranger learns their home address.
 * The button is disabled until they answer, and the server refuses an order with
 * no method regardless — a disabled button is a courtesy, not a check.
 */
export function FulfillmentChoice({
  action,
  idempotencyKey,
  pickupPoint,
  threadHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  idempotencyKey: string;
  pickupPoint: PickupPoint | null;
  threadHref: string;
}) {
  const [state, formAction] = useFormAction(action);
  const [method, setMethod] = useState<Method>(null);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input name="idempotency_key" type="hidden" value={idempotencyKey} />
      <input name="country_code" type="hidden" value="MX" />

      <fieldset
        aria-describedby={method === null ? "fulfillment-required" : undefined}
        className="space-y-3"
      >
        <legend className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">
          ¿Cómo lo recibes?
        </legend>

        <label className="flex items-start gap-3 rounded-2xl border border-line p-4" htmlFor="method-pickup">
          <input
            aria-describedby="pickup-desc"
            aria-labelledby="pickup-name"
            checked={method === "pickup"}
            className="mt-1 size-5 accent-brand"
            id="method-pickup"
            name="fulfillment_method"
            onChange={() => setMethod("pickup")}
            type="radio"
            value="pickup"
          />
          <span>
            <span className="block font-semibold text-ink" id="pickup-name">
              Recolección en tienda
            </span>
            <span className="mt-1 block text-sm text-muted" id="pickup-desc">
              Vas por él y no compartes tu dirección.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-2xl border border-line p-4" htmlFor="method-shipping">
          <input
            aria-describedby="shipping-desc"
            aria-labelledby="shipping-name"
            checked={method === "shipping"}
            className="mt-1 size-5 accent-brand"
            id="method-shipping"
            name="fulfillment_method"
            onChange={() => setMethod("shipping")}
            type="radio"
            value="shipping"
          />
          <span>
            <span className="block font-semibold text-ink" id="shipping-name">
              Envío a domicilio
            </span>
            <span className="mt-1 block text-sm text-muted" id="shipping-desc">
              Solo esta tienda y tú verán tu dirección.
            </span>
          </span>
        </label>

        {method === null ? (
          <p className="text-sm font-medium text-muted" id="fulfillment-required">
            Elige una opción para continuar.
          </p>
        ) : null}
      </fieldset>

      {method === "pickup" ? (
        <div className="rounded-2xl bg-background p-4 text-sm leading-6">
          {pickupPoint ? (
            <>
              <p className="font-semibold text-ink">
                {pickupPoint.locality}, {areaName(pickupPoint.administrative_area_code)}
              </p>
              <p className="mt-1 text-muted">
                Verás la dirección completa cuando el vendedor acepte tu pedido.
              </p>
            </>
          ) : (
            <p className="font-semibold text-ink">
              <a className="inline-flex min-h-11 items-center text-brand underline" href={threadHref}>
                Acuerden el punto de recolección en el chat
              </a>
            </p>
          )}
        </div>
      ) : null}

      <fieldset disabled={method !== "shipping"} hidden={method !== "shipping"}>
        <div className="space-y-4">
          <Field defaultValue={state.values?.recipient} error={state.errors?.recipient?.[0]} label="Nombre de quien recibe" name="recipient" required />
          <Field defaultValue={state.values?.address_line1} error={state.errors?.address_line1?.[0]} label="Calle y número" name="address_line1" required />
          <Field defaultValue={state.values?.address_line2} error={state.errors?.address_line2?.[0]} label="Interior o referencia" name="address_line2" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field defaultValue={state.values?.locality} error={state.errors?.locality?.[0]} label="Ciudad o localidad" name="locality" required />
            <Field defaultValue={state.values?.administrative_area} error={state.errors?.administrative_area?.[0]} label="Estado" name="administrative_area" required />
          </div>
          <Field defaultValue={state.values?.postal_code} error={state.errors?.postal_code?.[0]} label="Código postal" name="postal_code" required />
          <Field defaultValue={state.values?.delivery_instructions} error={state.errors?.delivery_instructions?.[0]} label="Instrucciones de entrega" name="delivery_instructions" />
        </div>
      </fieldset>

      {method !== null ? (
        <details className="rounded-2xl border border-line p-4">
          <summary className="cursor-pointer text-sm font-semibold text-ink">
            Otra persona recibe o recoge (opcional)
          </summary>
          <div className="mt-4 space-y-4">
            <Field defaultValue={state.values?.alt_contact_name} error={state.errors?.alt_contact_name?.[0]} label="Nombre de la otra persona" maxLength={80} name="alt_contact_name" />
            <Field defaultValue={state.values?.alt_contact_phone} error={state.errors?.alt_contact_phone?.[0]} inputMode="tel" label="Teléfono de la otra persona" name="alt_contact_phone" placeholder="3312345678" />
            <Field defaultValue={state.values?.alt_contact_note} error={state.errors?.alt_contact_note?.[0]} label="Quién es" maxLength={200} name="alt_contact_note" placeholder="mi hermana, recepción del edificio" />
          </div>
        </details>
      ) : null}

      <Field defaultValue={state.values?.buyer_note} error={state.errors?.buyer_note?.[0]} label="Nota para vendedor" name="buyer_note" />

      {state.message ? (
        <p className="rounded-xl bg-sale/10 p-3 text-sm font-medium text-sale" role="status">
          {state.message}
        </p>
      ) : null}

      <ConfirmButton chosen={method !== null} />
    </form>
  );
}
