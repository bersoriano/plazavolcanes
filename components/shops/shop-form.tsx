"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ImagePlus } from "lucide-react";

import type { ActionState } from "@/lib/action-state";
import { initialActionState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
  MEXICO_ADMINISTRATIVE_AREAS,
  SUPPORTED_COUNTRY,
} from "@/lib/shop-location";

type ShopFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  shop?: {
    name: string;
    description: string;
    imageUrl: string | null;
    countryCode: string;
    administrativeAreaCode: string | null;
  };
};

function SaveButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} type="submit">
      {pending ? "Guardando…" : editing ? "Guardar cambios" : "Crear tienda"}
    </Button>
  );
}

export function ShopForm({ action, shop }: ShopFormProps) {
  const [state, formAction] = useActionState(action, initialActionState);
  const [preview, setPreview] = useState(shop?.imageUrl ?? null);

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <Field
        defaultValue={shop?.name}
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
          defaultValue={shop?.description}
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
          <label className="block text-sm font-semibold text-ink" htmlFor="administrative-area">Estado</label>
          <select
            aria-describedby={state.errors?.administrative_area_code ? "administrative-area-error" : undefined}
            aria-invalid={Boolean(state.errors?.administrative_area_code)}
            className="min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-ink focus:border-brand focus:outline-none"
            defaultValue={shop?.administrativeAreaCode ?? ""}
            id="administrative-area"
            name="administrative_area_code"
            required
          >
            <option disabled value="">Selecciona un estado</option>
            {MEXICO_ADMINISTRATIVE_AREAS.map((area) => (
              <option key={area.code} value={area.code}>{area.label}</option>
            ))}
          </select>
          {state.errors?.administrative_area_code?.[0] ? <p className="text-sm font-medium text-sale" id="administrative-area-error">{state.errors.administrative_area_code[0]}</p> : null}
        </div>
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
          <span><strong className="block text-sm text-ink">Elige una imagen</strong><span className="mt-1 block text-xs text-muted">JPEG, PNG o WebP · máximo 5 MB</span></span>
        </label>
        <input
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          id="image"
          name="image"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) setPreview(URL.createObjectURL(file));
          }}
          type="file"
        />
        {state.errors?.image?.[0] ? <p className="text-sm font-medium text-sale">{state.errors.image[0]}</p> : null}
      </div>

      {state.message ? <p className={`rounded-2xl px-4 py-3 text-sm font-medium ${state.status === "success" ? "bg-accent/45 text-brand-hover" : "bg-sale/10 text-sale"}`} role="status">{state.message}</p> : null}
      <div className="flex justify-end"><SaveButton editing={Boolean(shop)} /></div>
    </form>
  );
}
