"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ImagePlus } from "lucide-react";

import type { ActionState } from "@/lib/action-state";
import { initialActionState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

type ShopFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  shop?: {
    name: string;
    description: string;
    imageUrl: string | null;
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
