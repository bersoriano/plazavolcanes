"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { ImagePlus, X } from "lucide-react";
import { unstable_rethrow } from "next/navigation";

import { CategoryFields } from "@/components/products/category-fields";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { requestProductImageUploads, sweepMyOrphanedImages } from "@/lib/actions/media";
import { inspectImage } from "@/lib/media/signature";
import { uploadWithTickets } from "@/lib/media/upload-client";
import { rejectionMessage } from "@/lib/media/validation";
import { MAX_PRODUCT_IMAGES } from "@/lib/media/validation";
import type { ActionState } from "@/lib/action-state";
import { useFormAction } from "@/lib/use-form-action";
import { useFormDraft } from "@/lib/form-draft";
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
  /** Needed to authorise an upload before the product row exists. */
  shopId: number;
  productId?: number;
  /** Bound to the product on the server; absent while the product does not exist yet. */
  removeImageAction?: (imageId: number) => Promise<void>;
};

export type ProductImage = { id: number; url: string | null; position: number };

/**
 * The gallery a product already holds. Removal asks first and asks inline: the
 * picture stays on screen next to the question, so a seller confirms the image
 * they meant rather than the one a modal took away from them.
 */
function StoredImages({
  images,
  onRemove,
}: {
  images: ProductImage[];
  onRemove?: (imageId: number) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(imageId: number) {
    if (!onRemove) return;
    setError(null);
    startTransition(async () => {
      try {
        await onRemove(imageId);
        setConfirming(null);
      } catch (cause) {
        // A rejected action may be Next redirecting or a page going missing,
        // and swallowing that would strand the seller on a dead page.
        unstable_rethrow(cause);
        setError("No pudimos eliminar la imagen. Intenta de nuevo.");
      }
    });
  }

  if (!images.length) return null;

  return (
    <>
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
              <span className="absolute left-1 top-1 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-brand-hover">Portada</span>
            ) : null}
            {onRemove ? (
              confirming === image.id ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-xl bg-ink/80 px-1 text-center">
                  <p className="text-[0.65rem] font-bold text-white">¿Eliminar?</p>
                  <button
                    aria-label={`Sí, eliminar imagen ${index + 1}`}
                    className="rounded-full bg-sale px-2 py-0.5 text-[0.65rem] font-semibold text-white disabled:opacity-60"
                    disabled={pending}
                    onClick={() => remove(image.id)}
                    type="button"
                  >
                    {pending ? "Eliminando…" : "Sí"}
                  </button>
                  <button
                    className="text-[0.65rem] font-semibold text-white/80 underline disabled:opacity-60"
                    disabled={pending}
                    onClick={() => setConfirming(null)}
                    type="button"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  aria-label={`Eliminar imagen ${index + 1}`}
                  className="tap-halo absolute -right-1 -top-1 grid size-6 place-items-center rounded-full border border-line bg-surface text-sale transition-colors hover:bg-sale hover:text-white"
                  onClick={() => {
                    setError(null);
                    setConfirming(image.id);
                  }}
                  type="button"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              )
            ) : null}
          </li>
        ))}
      </ul>
      {error ? <p className="text-sm font-medium text-sale" role="alert">{error}</p> : null}
    </>
  );
}

function ProductActions({ blocked, busy, status }: { blocked: boolean; busy: boolean; status?: "draft" | "published" }) {
  const { pending } = useFormStatus();
  const disabled = pending || busy || blocked;
  if (!status) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm leading-6 text-muted">Tu producto se guardará oculto como borrador. Podrás publicarlo cuando esté listo.</p>
        <Button disabled={disabled} type="submit">
          {pending ? "Guardando…" : busy ? "Subiendo imágenes…" : "Guardar producto"}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap justify-end gap-3">
      <Button disabled={disabled} name="status" type="submit" value="draft" variant="secondary">
        {status === "published" ? "Despublicar" : "Guardar borrador"}
      </Button>
      <Button disabled={disabled} name="status" type="submit" value="published">
        {pending ? "Guardando…" : busy ? "Subiendo imágenes…" : status === "published" ? "Guardar cambios" : "Publicar producto"}
      </Button>
    </div>
  );
}

export function ProductForm({
  action,
  categories,
  product,
  images = [],
  shopId,
  productId,
  removeImageAction,
}: ProductFormProps) {
  const [state, formAction] = useFormAction(action);
  const [preview, setPreview] = useState(product?.imageUrl ?? null);
  const [condition, setCondition] = useState<ProductCondition>(product?.condition ?? "new");
  const [uploading, setUploading] = useState(false);
  const [uploadedKeys, setUploadedKeys] = useState<string[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [recovered, setRecovered] = useState(false);
  const onRestored = useCallback(() => setRecovered(true), []);
  // Scoped per form, so a draft never leaks between products or shops.
  const draftKey = `producto:${product ? `editar:${product.name}` : "nuevo"}`;
  const { clear: clearDraft, formRef, save: saveDraft } = useFormDraft(draftKey, onRestored);

  useEffect(() => {
    if (state.status === "success") clearDraft();
  }, [clearDraft, state.status]);

  // Pictures reach storage the moment they are chosen, so a form somebody
  // walked away from left objects behind. Opening one is a good moment to
  // clear away the last abandoned attempt; failing to is not worth reporting.
  useEffect(() => {
    void sweepMyOrphanedImages().catch(() => {});
  }, []);

  /**
   * The pictures go straight to storage from here, and the form submits only
   * where they landed. Nothing is decoded and no bytes pass through the server,
   * which is what a phone could not survive.
   */
  async function handleImages(input: HTMLInputElement) {
    const chosen = Array.from(input.files ?? []);
    if (!chosen.length) return;

    setUploading(true);
    setImageError(null);
    try {
      const verdicts = await Promise.all(chosen.map((file) => inspectImage(file)));
      const rejected = verdicts.find((verdict) => !verdict.supported);
      if (rejected && !rejected.supported) {
        setImageError(rejectionMessage(rejected.reason));
        return;
      }

      const contentTypes = verdicts.flatMap((verdict) =>
        verdict.supported ? [verdict.type] : [],
      );
      const { tickets, error } = await requestProductImageUploads(
        shopId,
        productId ?? null,
        contentTypes,
      );
      if (!tickets) {
        setImageError(error);
        return;
      }

      const sent = await uploadWithTickets(tickets, chosen);
      if (sent.error) {
        setImageError(sent.error);
        return;
      }

      setUploadedKeys((current) => [...current, ...sent.keys]);
      setPreview(URL.createObjectURL(chosen[0]!));
      // The chosen files have served their purpose; keeping them on the input
      // would send the bytes with the form after all.
      input.value = "";
    } catch {
      setImageError("No pudimos subir las imágenes. Intenta de nuevo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={formAction} className="space-y-6" noValidate onInput={saveDraft} ref={formRef}>
      {recovered ? (
        <p className="rounded-2xl bg-accent/45 px-4 py-3 text-sm font-medium text-brand-hover" role="status">
          Recuperamos lo que habías escrito. Vuelve a elegir tus imágenes.
        </p>
      ) : null}
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

        <StoredImages images={images} onRemove={removeImageAction} />

        <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-line bg-background p-4 transition-colors hover:border-brand" htmlFor="product-images">
          <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface text-brand">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="Vista previa" className="size-full object-cover" src={preview} />
            ) : <ImagePlus aria-hidden="true" className="size-6" />}
          </span>
          <span>
            <strong className="block text-sm text-ink">Elige tus imágenes</strong>
            <span className="mt-1 block text-xs text-muted">JPEG, PNG o WebP · hasta 5 imágenes · las reducimos por ti</span>
            <span className="mt-1 block text-xs text-muted">La primera imagen es la portada.</span>
          </span>
        </label>
        <input accept="image/jpeg,image/png,image/webp" className="sr-only" id="product-images" multiple name="images" onChange={(event) => { void handleImages(event.currentTarget); }} type="file" />
        {images.length ? (
          <p className="text-xs text-muted">{`Quedan ${MAX_PRODUCT_IMAGES - images.length} espacios de ${MAX_PRODUCT_IMAGES}.`}</p>
        ) : null}
        {imageError ? <p className="text-sm font-medium text-sale" role="alert">{imageError}</p> : null}
        {state.errors?.images?.[0] ? <p className="text-sm font-medium text-sale">{state.errors.images[0]}</p> : null}
      </div>
      {state.message ? <p className={`rounded-2xl px-4 py-3 text-sm font-medium ${state.status === "success" ? "bg-accent/45 text-brand-hover" : "bg-sale/10 text-sale"}`} role="status">{state.message}</p> : null}
      {uploadedKeys.map((key) => (
        <input key={key} name="image_keys" type="hidden" value={key} />
      ))}
      <ProductActions blocked={Boolean(imageError)} busy={uploading} status={product?.status} />
    </form>
  );
}
