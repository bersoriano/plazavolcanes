"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { ImagePlus } from "lucide-react";

import type { ActionState } from "@/lib/action-state";
import { useFormAction } from "@/lib/use-form-action";
import { Button } from "@/components/ui/button";
import { requestShopImageUpload } from "@/lib/actions/media";
import { inspectImage } from "@/lib/media/signature";
import { uploadWithTickets } from "@/lib/media/upload-client";
import { rejectionMessage } from "@/lib/media/validation";
import { Field } from "@/components/ui/field";
import {
  MEXICO_ADMINISTRATIVE_AREAS,
  SUPPORTED_COUNTRY,
} from "@/lib/shop-location";

const AREA_FIELD_NAME = "administrative_area_codes";

type ShopFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  shop?: {
    name: string;
    description: string;
    imageUrl: string | null;
    countryCode: string;
    administrativeAreaCodes: string[];
  };
  pickupPoint?: {
    addressLine1: string;
    locality: string;
    administrativeAreaCode: string;
    postalCode: string;
    notes: string;
  } | null;
};

function SaveButton({ blocked, busy, editing }: { blocked: boolean; busy: boolean; editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending || busy || blocked} type="submit">
      {pending ? "Guardando…" : busy ? "Subiendo imagen…" : editing ? "Guardar cambios" : "Crear tienda"}
    </Button>
  );
}

export function ShopForm({ action, shop, pickupPoint }: ShopFormProps) {
  const [state, formAction] = useFormAction(action);
  const [preview, setPreview] = useState(shop?.imageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  /** The picture goes straight to storage; the form submits only its key. */
  async function handleImage(input: HTMLInputElement) {
    const chosen = input.files?.[0];
    if (!chosen) return;

    setUploading(true);
    setImageError(null);
    try {
      const verdict = await inspectImage(chosen);
      if (!verdict.supported) {
        setImageError(rejectionMessage(verdict.reason));
        return;
      }

      const { tickets, error } = await requestShopImageUpload(verdict.type);
      if (!tickets) {
        setImageError(error);
        return;
      }

      const sent = await uploadWithTickets(tickets, [chosen]);
      if (sent.error || !sent.keys[0]) {
        setImageError(sent.error ?? "No pudimos subir la imagen.");
        return;
      }

      setImageKey(sent.keys[0]);
      setPreview(URL.createObjectURL(chosen));
      input.value = "";
    } catch {
      setImageError("No pudimos subir la imagen. Intenta de nuevo.");
    } finally {
      setUploading(false);
    }
  }

  const [primaryArea, setPrimaryArea] = useState(shop?.administrativeAreaCodes?.[0] ?? "");
  const [secondaryArea, setSecondaryArea] = useState(shop?.administrativeAreaCodes?.[1] ?? "");
  const [offersPickup, setOffersPickup] = useState(Boolean(pickupPoint));

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <Field
        defaultValue={state.values?.name ?? shop?.name}
        error={state.errors?.name?.[0]}
        label="Nombre de la tienda"
        maxLength={80}
        name="name"
        placeholder="Casa Niebla"
        required
      />

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-ink" htmlFor="description">Descripción</label>
        <textarea
          aria-describedby={state.errors?.description ? "description-error" : undefined}
          aria-invalid={Boolean(state.errors?.description)}
          className="min-h-36 w-full resize-y rounded-2xl border border-line bg-surface px-4 py-3 text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none"
          defaultValue={state.values?.description ?? shop?.description}
          id="description"
          maxLength={1200}
          name="description"
          placeholder="Cuenta qué haces y qué hace especial a tu tienda."
          required
        />
        {state.errors?.description?.[0] ? <p className="text-sm font-medium text-sale" id="description-error">{state.errors.description[0]}</p> : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-ink" htmlFor="country">País</label>
          <select
            className="min-h-12 w-full cursor-not-allowed rounded-2xl border border-line bg-background px-4 text-muted"
            disabled
            id="country"
            value={SUPPORTED_COUNTRY.code}
          >
            <option value={SUPPORTED_COUNTRY.code}>{SUPPORTED_COUNTRY.label}</option>
          </select>
          <input name="country_code" type="hidden" value={SUPPORTED_COUNTRY.code} />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-ink" htmlFor="administrative-area">Estado principal</label>
          <select
            aria-describedby={state.errors?.administrative_area_codes ? "administrative-area-error" : undefined}
            aria-invalid={Boolean(state.errors?.administrative_area_codes)}
            className="min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-ink focus:border-brand focus:outline-none"
            id="administrative-area"
            name={AREA_FIELD_NAME}
            onChange={(event) => {
              setPrimaryArea(event.target.value);
              // The second select must never repeat the primary state.
              if (event.target.value === secondaryArea) setSecondaryArea("");
            }}
            required
            value={primaryArea}
          >
            <option disabled value="">Selecciona un estado</option>
            {MEXICO_ADMINISTRATIVE_AREAS.map((area) => (
              <option key={area.code} value={area.code}>{area.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-ink" htmlFor="secondary-administrative-area">Segundo estado (opcional)</label>
          <select
            aria-describedby={state.errors?.administrative_area_codes ? "administrative-area-error" : undefined}
            aria-invalid={Boolean(state.errors?.administrative_area_codes)}
            className="min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-ink focus:border-brand focus:outline-none"
            id="secondary-administrative-area"
            name={AREA_FIELD_NAME}
            onChange={(event) => setSecondaryArea(event.target.value)}
            value={secondaryArea}
          >
            <option value="">Sin segundo estado</option>
            {MEXICO_ADMINISTRATIVE_AREAS.filter((area) => area.code !== primaryArea).map((area) => (
              <option key={area.code} value={area.code}>{area.label}</option>
            ))}
          </select>
          <p className="text-xs text-muted">Agrega un segundo estado si también vendes o entregas ahí.</p>
        </div>
        <div className="space-y-2 sm:col-span-2">
          {state.errors?.administrative_area_codes?.[0] ? <p className="text-sm font-medium text-sale" id="administrative-area-error">{state.errors.administrative_area_codes[0]}</p> : null}
        </div>
      </div>

      {/* Only while creating: once the shop exists the policy is saved on its
          own, because the database accepts a change to it once a month. */}
      {shop ? null : (
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-ink" htmlFor="delivery_policy">
            Política de entregas <span className="font-normal text-muted">(opcional)</span>
          </label>
          <textarea
            aria-describedby="delivery-policy-hint"
            aria-invalid={Boolean(state.errors?.delivery_policy)}
            className="min-h-28 w-full resize-y rounded-2xl border border-line bg-surface px-4 py-3 text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none"
            defaultValue={state.values?.delivery_policy}
            id="delivery_policy"
            maxLength={1200}
            name="delivery_policy"
            placeholder="Cómo envías, a dónde llegas en persona, cuánto tardas y qué necesitas de quien compra."
          />
          <p className="text-xs text-muted" id="delivery-policy-hint">
            Quien compre la verá en tu tienda pública. Después de crearla podrás cambiarla una vez
            al mes.
          </p>
          {state.errors?.delivery_policy?.[0] ? (
            <p className="text-sm font-medium text-sale">{state.errors.delivery_policy[0]}</p>
          ) : null}
        </div>
      )}

      <div className="space-y-4 border-t border-line pt-6">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-ink" htmlFor="offers_pickup">
          <input
            checked={offersPickup}
            className="size-5 rounded border-line accent-brand"
            id="offers_pickup"
            name="offers_pickup"
            onChange={(event) => setOffersPickup(event.target.checked)}
            type="checkbox"
          />
          Ofrezco recolección en tienda
        </label>
        <p className="text-sm leading-6 text-muted">
          Quien compre verá la ciudad al pedir, y la dirección completa cuando aceptes el pedido.
        </p>

        {offersPickup ? (
          <div className="space-y-4">
            <Field
              defaultValue={state.values?.pickup_address_line1 ?? pickupPoint?.addressLine1}
              error={state.errors?.pickup_address_line1?.[0]}
              label="Calle y número de recolección"
              maxLength={200}
              name="pickup_address_line1"
              required
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                defaultValue={state.values?.pickup_locality ?? pickupPoint?.locality}
                error={state.errors?.pickup_locality?.[0]}
                label="Ciudad de recolección"
                maxLength={120}
                name="pickup_locality"
                required
              />
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-ink" htmlFor="pickup_administrative_area_code">
                  Estado de recolección
                </label>
                <select
                  aria-describedby={
                    state.errors?.pickup_administrative_area_code
                      ? "pickup-administrative-area-code-error"
                      : undefined
                  }
                  aria-invalid={Boolean(state.errors?.pickup_administrative_area_code)}
                  className="min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-ink focus:border-brand focus:outline-none"
                  defaultValue={
                    state.values?.pickup_administrative_area_code
                      ?? pickupPoint?.administrativeAreaCode
                      ?? primaryArea
                  }
                  id="pickup_administrative_area_code"
                  key={
                    state.values?.pickup_administrative_area_code
                      ?? pickupPoint?.administrativeAreaCode
                      ?? primaryArea
                  }
                  name="pickup_administrative_area_code"
                  required
                >
                  {MEXICO_ADMINISTRATIVE_AREAS.map((area) => (
                    <option key={area.code} value={area.code}>
                      {area.label}
                    </option>
                  ))}
                </select>
                {state.errors?.pickup_administrative_area_code?.[0] ? (
                  <p
                    className="text-sm font-medium text-sale"
                    id="pickup-administrative-area-code-error"
                  >
                    {state.errors.pickup_administrative_area_code[0]}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                defaultValue={state.values?.pickup_postal_code ?? pickupPoint?.postalCode}
                error={state.errors?.pickup_postal_code?.[0]}
                inputMode="numeric"
                label="Código postal de recolección"
                maxLength={5}
                name="pickup_postal_code"
                required
              />
              <Field
                defaultValue={state.values?.pickup_notes ?? pickupPoint?.notes}
                error={state.errors?.pickup_notes?.[0]}
                label="Referencias para llegar"
                maxLength={500}
                name="pickup_notes"
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-ink" htmlFor="image">Imagen de la tienda <span className="font-normal text-muted">(opcional)</span></label>
        <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-line bg-background p-4 transition-colors hover:border-brand" htmlFor="image">
          <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface text-brand">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="Vista previa" className="size-full object-cover" src={preview} />
            ) : <ImagePlus aria-hidden="true" className="size-6" />}
          </span>
          <span><strong className="block text-sm text-ink">Elige una imagen</strong><span className="mt-1 block text-xs text-muted">JPEG, PNG o WebP · la reducimos por ti</span></span>
        </label>
        <input
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          id="image"
          name="image"
          onChange={(event) => {
            void handleImage(event.currentTarget);
          }}
          type="file"
        />
        {imageKey ? <input name="image_key" type="hidden" value={imageKey} /> : null}
        {imageError ? <p className="text-sm font-medium text-sale" role="alert">{imageError}</p> : null}
        {state.errors?.image?.[0] ? <p className="text-sm font-medium text-sale">{state.errors.image[0]}</p> : null}
      </div>

      {state.message ? <p className={`rounded-2xl px-4 py-3 text-sm font-medium ${state.status === "success" ? "bg-accent/45 text-brand-hover" : "bg-sale/10 text-sale"}`} role="status">{state.message}</p> : null}
      <div className="flex justify-end"><SaveButton blocked={Boolean(imageError)} busy={uploading} editing={Boolean(shop)} /></div>
    </form>
  );
}
