"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { ImagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { initialActionState } from "@/lib/action-state";

type ProductFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  product?: {
    name: string;
    description: string;
    price_mxn: number;
    status: "draft" | "published";
    imageUrl: string | null;
  };
};

function ProductActions({ status }: { status: "draft" | "published" }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap justify-end gap-3">
      <Button disabled={pending} name="status" type="submit" value="draft" variant="secondary">{status === "published" ? "Despublicar" : "Guardar borrador"}</Button>
      <Button disabled={pending} name="status" type="submit" value="published">{pending ? "Guardando…" : status === "published" ? "Guardar cambios" : "Publicar producto"}</Button>
    </div>
  );
}

export function ProductForm({ action, product }: ProductFormProps) {
  const [state, formAction] = useActionState(action, initialActionState);
  const [preview, setPreview] = useState(product?.imageUrl ?? null);
  useEffect(() => () => { if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <Field defaultValue={product?.name} error={state.errors?.name?.[0]} label="Nombre del producto" maxLength={120} name="name" placeholder="Taza de barro" required />
      <div className="space-y-2"><label className="block text-sm font-semibold text-ink" htmlFor="description">Descripción</label><textarea aria-describedby={state.errors?.description ? "description-error" : undefined} aria-invalid={Boolean(state.errors?.description)} className="min-h-40 w-full resize-y rounded-2xl border border-line bg-surface px-4 py-3 text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none" defaultValue={product?.description} id="description" maxLength={3000} name="description" placeholder="Materiales, proceso, medidas y cualquier detalle importante." required />{state.errors?.description?.[0] ? <p className="text-sm font-medium text-sale" id="description-error">{state.errors.description[0]}</p> : null}</div>
      <Field defaultValue={product?.price_mxn} error={state.errors?.price_mxn?.[0]} inputMode="decimal" label="Precio en MXN" min="0" name="price_mxn" placeholder="349.00" required step="0.01" type="number" />
      <div className="space-y-2"><label className="block text-sm font-semibold text-ink" htmlFor="product-image">Imagen del producto <span className="font-normal text-muted">(opcional)</span></label><label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-line bg-background p-4 transition-colors hover:border-brand" htmlFor="product-image"><span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface text-brand">{preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="Vista previa" className="size-full object-cover" src={preview} />
      ) : <ImagePlus aria-hidden="true" className="size-6" />}</span><span><strong className="block text-sm text-ink">Elige una imagen</strong><span className="mt-1 block text-xs text-muted">JPEG, PNG o WebP · máximo 5 MB</span></span></label><input accept="image/jpeg,image/png,image/webp" className="sr-only" id="product-image" name="image" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) setPreview(URL.createObjectURL(file)); }} type="file" />{state.errors?.image?.[0] ? <p className="text-sm font-medium text-sale">{state.errors.image[0]}</p> : null}</div>
      {state.message ? <p className={`rounded-2xl px-4 py-3 text-sm font-medium ${state.status === "success" ? "bg-accent/45 text-brand-hover" : "bg-sale/10 text-sale"}`} role="status">{state.message}</p> : null}
      <ProductActions status={product?.status ?? "draft"} />
    </form>
  );
}
