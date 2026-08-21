"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { ImagePlus } from "lucide-react";

import { CategoryFields } from "@/components/products/category-fields";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { MAX_PRODUCT_IMAGES } from "@/lib/storage";
import type { ActionState } from "@/lib/action-state";
import { useFormAction } from "@/lib/use-form-action";
import type { CategoryTree } from "@/lib/categories";
import {
  USED_CONDITION_OPTIONS,
  type ProductCondition,
  type UsedCondition,
} from "@/lib/product-condition";

type ProductFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  categories: CategoryTree[];
  product?: {
    name: string;
    description: string;
    price_mxn: number;
    status: "draft" | "published";
    condition: ProductCondition;
    used_condition: UsedCondition | null;
    category_id: number | null;
    handling_days?: number;
    units_available?: number;
    imageUrl: string | null;
  };
  images?: ProductImage[];
};

export type ProductImage = { id: number; url: string | null; position: number };

function ProductActions({ status }: { status: "draft" | "published" }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap justify-end gap-3">
      <Button disabled={pending} name="status" type="submit" value="draft" variant="secondary">
        {status === "published" ? "Despublicar" : "Guardar borrador"}
      </Button>
      <Button disabled={pending} name="status" type="submit" value="published">
        {pending ? "Guardando…" : status === "published" ? "Guardar cambios" : "Publicar producto"}
      </Button>
    </div>
  );
}

export function ProductForm({ action, categories, product, images = [] }: ProductFormProps) {
  const [state, formAction] = useFormAction(action);
  const [preview, setPreview] = useState(product?.imageUrl ?? null);
  const [condition, setCondition] = useState<ProductCondition>(product?.condition ?? "new");

  useEffect(() => () => {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <input name="currency_code" type="hidden" value="MXN" />
      <input name="content_locale" type="hidden" value="es-MX" />
      <CategoryFields
        categories={categories}
        error={state.errors?.category_id?.[0]}
        selectedLeafId={product?.category_id}
      />
      <Field defaultValue={state.values?.name ?? product?.name} error={state.errors?.name?.[0]} label="Nombre del producto" maxLength={120} name="name" placeholder="Taza de barro" required />
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-ink" htmlFor="description">Descripción</label>
        <textarea aria-describedby={state.errors?.description ? "description-error" : undefined} aria-invalid={Boolean(state.errors?.description)} className="min-h-40 w-full resize-y rounded-2xl border border-line bg-surface px-4 py-3 text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none" defaultValue={state.values?.description ?? product?.description} id="description" maxLength={3000} name="description" placeholder="Materiales, proceso, medidas y cualquier detalle importante." required />
        {state.errors?.description?.[0] ? <p className="text-sm font-medium text-sale" id="description-error">{state.errors.description[0]}</p> : null}
      </div>
      <Field defaultValue={state.values?.price_mxn ?? product?.price_mxn} error={state.errors?.price_mxn?.[0]} inputMode="decimal" label="Precio en MXN" min="0" name="price_mxn" placeholder="349.00" required step="0.01" type="number" />
      <Field defaultValue={state.values?.handling_days ?? product?.handling_days ?? 3} error={state.errors?.handling_days?.[0]} inputMode="numeric" label="Tiempo de preparación (días hábiles)" max="30" min="1" name="handling_days" required type="number" />
      <Field defaultValue={state.values?.units_available ?? product?.units_available ?? 1} error={state.errors?.units_available?.[0]} inputMode="numeric" label="Unidades disponibles" max="10" min="1" name="units_available" required type="number" />

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-ink">Condición</legend>
        <div className="grid grid-cols-2 gap-3">
          {(["new", "used"] as const).map((value) => (
            <label className={`cursor-pointer rounded-2xl border px-4 py-3 text-center text-sm font-semibold transition-colors ${condition === value ? "border-brand bg-accent/45 text-brand-hover" : "border-line bg-surface text-muted hover:border-brand"}`} key={value}>
              <input checked={condition === value} className="sr-only" name="condition" onChange={() => setCondition(value)} type="radio" value={value} />
              {value === "new" ? "Nuevo" : "Usado"}
            </label>
          ))}
        </div>
      </fieldset>

      {condition === "used" ? (
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-ink" htmlFor="used-condition">Estado del producto usado</label>
          <select aria-describedby={state.errors?.used_condition ? "used-condition-error" : undefined} aria-invalid={Boolean(state.errors?.used_condition)} className="min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-ink focus:border-brand focus:outline-none" defaultValue={state.values?.used_condition ?? product?.used_condition ?? ""} id="used-condition" key={`used-condition-${state.values?.used_condition ?? ""}`} name="used_condition" required>
            <option disabled value="">Selecciona una opción</option>
            {USED_CONDITION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          {state.errors?.used_condition?.[0] ? <p className="text-sm font-medium text-sale" id="used-condition-error">{state.errors.used_condition[0]}</p> : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-ink" htmlFor="product-images">Imágenes del producto <span className="font-normal text-muted">(opcional)</span></label>

        {images.length ? (
          <ul className="flex flex-wrap gap-3">
            {images.map((image, index) => (
              <li className="relative" key={image.id}>
                <span className="block size-24 overflow-hidden rounded-xl bg-background">
                  {image.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={`Imagen ${index + 1}`} className="size-full object-cover" src={image.url} />
                  ) : null}
                </span>
                {index === 0 ? (
                  <span className="absolute left-1 top-1 rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-bold text-brand-hover">Portada</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-line bg-background p-4 transition-colors hover:border-brand" htmlFor="product-images">
          <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface text-brand">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="Vista previa" className="size-full object-cover" src={preview} />
            ) : <ImagePlus aria-hidden="true" className="size-6" />}
          </span>
          <span>
            <strong className="block text-sm text-ink">Elige tus imágenes</strong>
            <span className="mt-1 block text-xs text-muted">JPEG, PNG o WebP · hasta 5 imágenes · máximo 2 MB cada una</span>
            <span className="mt-1 block text-xs text-muted">La primera imagen es la portada.</span>
          </span>
        </label>
        <input accept="image/jpeg,image/png,image/webp" className="sr-only" id="product-images" multiple name="images" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) setPreview(URL.createObjectURL(file)); }} type="file" />
        {images.length ? (
          <p className="text-xs text-muted">{`Quedan ${MAX_PRODUCT_IMAGES - images.length} espacios de ${MAX_PRODUCT_IMAGES}.`}</p>
        ) : null}
        {state.errors?.images?.[0] ? <p className="text-sm font-medium text-sale">{state.errors.images[0]}</p> : null}
      </div>
      {state.message ? <p className={`rounded-2xl px-4 py-3 text-sm font-medium ${state.status === "success" ? "bg-accent/45 text-brand-hover" : "bg-sale/10 text-sale"}`} role="status">{state.message}</p> : null}
      <ProductActions status={product?.status ?? "draft"} />
    </form>
  );
}
