"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { ImagePlus, X } from "lucide-react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";

import { CategoryFields } from "@/components/products/category-fields";
import { ShareActions } from "@/components/share/share-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { requestProductImageUploads, sweepMyOrphanedImages } from "@/lib/actions/media";
import { inspectImage } from "@/lib/media/signature";
import { uploadWithTickets } from "@/lib/media/upload-client";
import { rejectionMessage } from "@/lib/media/validation";
import { MAX_PRODUCT_IMAGES } from "@/lib/media/validation";
import {
  listingQualityTips,
  MAX_UNITS,
  missingForPublication,
  type ListingReadinessInput,
} from "@/lib/listing-readiness";
import { getShopPublicationApproval, type SellerListingFlags } from "@/lib/seller-publication";
import type { ActionState } from "@/lib/action-state";
import { useFormAction } from "@/lib/use-form-action";
import { forgetFormDraft, useFormDraft } from "@/lib/form-draft";
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
    description: string | null;
    price_mxn: number | null;
    status: "draft" | "published";
    condition: ProductCondition | null;
    used_condition: UsedCondition | null;
    category_id: number | null;
    handling_days?: number | null;
    units_available?: number | null;
    imageUrl: string | null;
  };
  images?: ProductImage[];
  shopPublication?: Pick<SellerListingFlags, "is_publishing_approved" | "publishing_reviewed_at">;
  isAdminEnabled?: boolean;
  draftSaved?: boolean;
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
              <Badge variant="unstyled" className="absolute left-1 top-1 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-brand-hover">Portada</Badge>
            ) : null}
            {onRemove ? (
              confirming === image.id ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-xl bg-ink/80 px-1 text-center">
                  <p className="text-[0.65rem] font-bold text-white">¿Eliminar?</p>
                  <Button
                    variant="danger"
                    aria-label={`Sí, eliminar imagen ${index + 1}`}
                    className="px-2 py-0.5 text-[0.65rem] disabled:opacity-60"
                    disabled={pending}
                    onClick={() => remove(image.id)}
                    type="button"
                  >
                    {pending ? "Eliminando…" : "Sí"}
                  </Button>
                  <Button
                    variant="unstyled"
                    className="text-[0.65rem] font-semibold text-white/80 underline disabled:opacity-60"
                    disabled={pending}
                    onClick={() => setConfirming(null)}
                    type="button"
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button
                  variant="unstyled"
                  aria-label={`Eliminar imagen ${index + 1}`}
                  className="tap-halo absolute -right-1 -top-1 grid size-6 place-items-center rounded-full border border-line bg-surface text-sale transition-colors hover:bg-sale hover:text-white"
                  onClick={() => {
                    setError(null);
                    setConfirming(image.id);
                  }}
                  type="button"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </Button>
              )
            ) : null}
          </li>
        ))}
      </ul>
      {error ? <p className="text-sm font-medium text-sale" role="alert">{error}</p> : null}
    </>
  );
}

/**
 * The publish button stays live even when the listing is not ready yet.
 *
 * PR #29 disabled it until a cover image existed, because nothing on the page
 * could say what was missing. The checklist above says exactly that now, and a
 * dead button explains nothing — so the seller may always press it, and the
 * server action refuses with the first unmet requirement. One rule, stated
 * once, enforced where it counts.
 */
function ProductActions({ blocked, busy, status, publishLabel, withdrawLabel }: { blocked: boolean; busy: boolean; status?: "draft" | "published"; publishLabel: string; withdrawLabel: string }) {
  const { pending } = useFormStatus();
  const disabled = pending || busy || blocked;
  if (!status) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm leading-6 text-muted">Tu producto se guardará oculto como borrador. Podrás publicarlo cuando esté listo.</p>
        <Button disabled={disabled} type="submit">
          {pending ? "Guardando…" : busy ? "Subiendo imágenes…" : "Guardar borrador"}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap justify-end gap-3">
      <Button disabled={disabled} name="status" type="submit" value="draft" variant="secondary">
        {status === "published" ? withdrawLabel : "Guardar borrador"}
      </Button>
      <Button disabled={disabled} name="status" type="submit" value="published">
        {pending ? "Guardando…" : busy ? "Subiendo imágenes…" : status === "published" ? "Guardar cambios" : publishLabel}
      </Button>
    </div>
  );
}

function PublicationChecklist({
  imageCount, name, description, price_mxn, condition, used_condition, category_id, handling_days, units_available,
}: Parameters<typeof missingForPublication>[0]) {
  const input = { imageCount, name, description, price_mxn, condition, used_condition, category_id, handling_days, units_available };
  const missing = missingForPublication(input);
  const tips = listingQualityTips(input);
  return <aside aria-labelledby="publication-readiness" className="rounded-2xl border border-line bg-background p-4">
    <h2 className="font-display text-xl font-semibold" id="publication-readiness">Antes de publicar</h2>
    <p className="mt-1 text-sm text-muted">Completa estos requisitos; se revisan otra vez al guardar.</p>
    <ul className="mt-2 text-sm">{missing.map((item) => <li key={item.field}><a className="flex min-h-11 items-center font-medium text-brand underline underline-offset-2" href={`#${item.target}`}>{item.label}</a></li>)}</ul>
    <h3 className="mt-4 text-sm font-semibold">Sugerencias para vender mejor</h3>
    {tips.length ? <ul className="mt-1 text-sm text-muted">{tips.map((item) => <li key={item.field}><a className="flex min-h-11 items-center underline underline-offset-2" href={`#${item.target}`}>{item.label}</a></li>)}</ul> : <p className="mt-2 text-sm text-muted">Tu publicación ya tiene una buena base.</p>}
  </aside>;
}

function numberOrNull(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formReadiness(form: HTMLFormElement | null, imageCount: number): ListingReadinessInput {
  if (!form) {
    return { imageCount, name: null, description: null, price_mxn: null, condition: null, used_condition: null, category_id: null, handling_days: null, units_available: null };
  }
  const values = new FormData(form);
  const condition = values.get("condition");
  const usedCondition = values.get("used_condition");
  return {
    imageCount,
    name: values.get("name") as string | null,
    description: values.get("description") as string | null,
    price_mxn: numberOrNull(values.get("price_mxn")),
    condition: condition === "new" || condition === "used" ? condition : null,
    used_condition: ["mint", "good", "fair", "bad", "scrap"].includes(String(usedCondition)) ? usedCondition as UsedCondition : null,
    category_id: numberOrNull(values.get("category_id")),
    handling_days: numberOrNull(values.get("handling_days")),
    units_available: numberOrNull(values.get("units_available")),
  };
}

const newProductDraftKey = (shopId: number) => `producto:nuevo:${shopId}`;

export function ProductForm({
  action,
  categories,
  product,
  images = [],
  shopId,
  productId,
  removeImageAction,
  shopPublication = { is_publishing_approved: true, publishing_reviewed_at: null },
  isAdminEnabled = true,
  draftSaved = false,
}: ProductFormProps) {
  const [uploadedKeys, setUploadedKeys] = useState<string[]>([]);
  const [state, formAction] = useFormAction(async (previous, formData) => {
    try {
      const result = await action(previous, formData);
      // Successful uploads now belong to the stored gallery. Errors retain keys
      // so the seller can retry without uploading photos again.
      if (result.status === "success") setUploadedKeys([]);
      return result;
    } catch (cause) {
      unstable_rethrow(cause);
      return { status: "error", message: "No pudimos guardar el producto. Intenta de nuevo." };
    }
  });
  const approval = getShopPublicationApproval(shopPublication);
  const publishLabel = !isAdminEnabled || approval.kind === "shop_disabled" ? "Guardar para publicar" : approval.kind === "awaiting_approval" ? "Dejar pendiente de aprobación" : "Publicar producto";
  const withdrawLabel = approval.kind === "awaiting_approval" && isAdminEnabled ? "Retirar de pendientes" : approval.kind !== "approved" || !isAdminEnabled ? "Guardar como borrador" : "Despublicar";
  const [showDraftSaved] = useState(draftSaved);
  useEffect(() => {
    if (!draftSaved) return;
    // createProduct redirects here instead of reporting success to the form
    // that held the draft, so the next new product would otherwise reopen it.
    forgetFormDraft(newProductDraftKey(shopId));
    forgetFormDraft("producto:nuevo"); // saved before drafts were kept per shop
    const url = new URL(window.location.href);
    url.searchParams.delete("creado");
    // Consume only the creation flag; keep other feedback, filters and anchors.
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [draftSaved, shopId]);
  const [preview, setPreview] = useState(product?.imageUrl ?? null);
  const [condition, setCondition] = useState<ProductCondition>(product?.condition ?? "new");
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [recovered, setRecovered] = useState(false);
  const onRestored = useCallback(() => setRecovered(true), []);
  // Scoped per form, so a draft never leaks between products or shops.
  // By id, not name: names repeat and change.
  const draftKey = productId === undefined ? newProductDraftKey(shopId) : `producto:editar:${productId}`;
  const { clear: clearDraft, formRef, save: saveDraft } = useFormDraft(draftKey, onRestored);
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    // React queues synthetic reset handlers during commit, after the browser
    // resets controls. Cancel the native event synchronously to retain this editor.
    const preserveFields = (event: Event) => event.preventDefault();
    form.addEventListener("reset", preserveFields);
    return () => form.removeEventListener("reset", preserveFields);
  }, [formRef]);
  const [readiness, setReadiness] = useState<ListingReadinessInput>(() => ({
    imageCount: images.length,
    name: product?.name ?? null,
    description: product?.description ?? null,
    price_mxn: product?.price_mxn ?? null,
    condition: product?.condition ?? "new",
    used_condition: product?.used_condition ?? null,
    category_id: product?.category_id ?? null,
    handling_days: product?.handling_days ?? 3,
    units_available: product?.units_available ?? 1,
  }));
  const publicUrl = state.status === "success" ? state.values?.public_url : undefined;
  const nextRequirement = state.status === "success" ? state.values?.next_requirement : undefined;

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
      setReadiness((current) => ({
        ...current,
        imageCount: images.length + uploadedKeys.length + sent.keys.length,
      }));
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
    // React's onChange, not onInput: a native input event re-renders before a
    // select's change event, snapping the controlled category selects back.
    // CategoryFields reports category_id itself; the DOM still holds the old
    // subcategory until it re-renders.
    <form action={formAction} className="space-y-6" data-analytics-event="seller_product_submitted" noValidate onChange={() => {
      saveDraft();
      const next = formReadiness(formRef.current, images.length + uploadedKeys.length);
      setReadiness((current) => ({ ...next, category_id: current.category_id }));
    }} ref={formRef}>
      {showDraftSaved && !state.message ? (
        <div className="rounded-2xl bg-accent/45 px-4 py-3 text-sm text-brand-hover" role="status" aria-live="polite">
          <p className="font-semibold">Borrador guardado</p>
          <p>Tu producto sigue privado. Siguiente paso: completa los requisitos y elige «{publishLabel}».</p>
        </div>
      ) : null}
      {recovered ? (
        <p className="rounded-2xl bg-accent/45 px-4 py-3 text-sm font-medium text-brand-hover" role="status">
          Recuperamos lo que habías escrito. Vuelve a elegir tus imágenes.
        </p>
      ) : null}
      <input name="currency_code" type="hidden" value="MXN" />
      <input name="content_locale" type="hidden" value="es-MX" />
      <PublicationChecklist {...readiness} imageCount={images.length + uploadedKeys.length} />
      <CategoryFields
        categories={categories}
        error={state.errors?.category_id?.[0]}
        selectedLeafId={product?.category_id}
        onSelectionChange={(category_id) => setReadiness((current) => ({ ...current, category_id }))}
      />
      <Field defaultValue={state.values?.name ?? product?.name} error={state.errors?.name?.[0]} label="Nombre del producto" maxLength={120} name="name" placeholder="Taza de barro" required />
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-ink" htmlFor="description">Descripción</label>
        <Textarea aria-describedby={state.errors?.description ? "description-error" : undefined} aria-invalid={Boolean(state.errors?.description)} className="min-h-40" defaultValue={state.values?.description ?? product?.description ?? undefined} id="description" maxLength={3000} name="description" placeholder="Materiales, proceso, medidas y cualquier detalle importante." />
        {state.errors?.description?.[0] ? <p className="text-sm font-medium text-sale" id="description-error">{state.errors.description[0]}</p> : null}
      </div>
      <Field defaultValue={state.values?.price_mxn ?? product?.price_mxn ?? undefined} error={state.errors?.price_mxn?.[0]} inputMode="decimal" label="Precio en MXN" min="0" name="price_mxn" placeholder="349.00" step="0.01" type="number" />
      <Field defaultValue={state.values?.handling_days ?? (product ? (product.handling_days ?? undefined) : 3)} error={state.errors?.handling_days?.[0]} inputMode="numeric" label="Tiempo de preparación (días hábiles)" max="30" min="1" name="handling_days" type="number" />
      <Field defaultValue={state.values?.units_available ?? (product ? (product.units_available ?? undefined) : 1)} error={state.errors?.units_available?.[0]} inputMode="numeric" hint="Cada pedido descuenta sus unidades. Escribe 0 si se agotó." label="Unidades disponibles" max={MAX_UNITS} min="0" name="units_available" type="number" />

      <fieldset className="space-y-3" id="condition">
        <legend className="text-sm font-semibold text-ink">Condición</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(["new", "used"] as const).map((value) => (
            <label className={`cursor-pointer rounded-2xl border px-4 py-3 text-center text-sm font-semibold transition-colors ${condition === value ? "border-brand bg-accent/45 text-brand-hover" : "border-line bg-surface text-muted hover:border-brand"}`} key={value}>
              <Input variant="unstyled" checked={condition === value} className="sr-only" name="condition" onChange={() => setCondition(value)} type="radio" value={value} />
              {value === "new" ? "Nuevo" : "Usado"}
            </label>
          ))}
        </div>
      </fieldset>

      {condition === "used" ? (
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-ink" htmlFor="used-condition">Estado del producto usado</label>
          <Select aria-describedby={state.errors?.used_condition ? "used-condition-error" : undefined} aria-invalid={Boolean(state.errors?.used_condition)}  defaultValue={state.values?.used_condition ?? product?.used_condition ?? ""} id="used-condition" name="used_condition">
            <option value="">Sin decidir</option>
            {USED_CONDITION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
          {state.errors?.used_condition?.[0] ? <p className="text-sm font-medium text-sale" id="used-condition-error">{state.errors.used_condition[0]}</p> : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-ink" htmlFor="product-images">Imágenes del producto <span className="font-normal text-muted">(necesarias para publicar)</span></label>
        {/* A draft may be saved without them (allow_incomplete_product_drafts); the cover trigger refuses to publish without one. */}
        <p className="text-xs text-muted">Puedes guardar el borrador sin imágenes; para publicar necesitas al menos una, que será la portada.</p>

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
        <Input variant="unstyled" accept="image/jpeg,image/png,image/webp" className="sr-only" id="product-images" multiple name="images" onChange={(event) => { void handleImages(event.currentTarget); }} type="file" />
        {images.length ? (
          <p className="text-xs text-muted">{`Quedan ${MAX_PRODUCT_IMAGES - images.length} espacios de ${MAX_PRODUCT_IMAGES}.`}</p>
        ) : null}
        {product ? (
          <p className={`text-xs font-medium ${images.length || uploadedKeys.length ? "text-success" : "text-sale"}`} role="status">
            {images.length || uploadedKeys.length ? "Portada lista para publicar." : "Agrega una imagen de portada antes de publicar."}
          </p>
        ) : null}
        {imageError ? <p className="text-sm font-medium text-sale" role="alert">{imageError}</p> : null}
        {state.errors?.images?.[0] ? <p className="text-sm font-medium text-sale">{state.errors.images[0]}</p> : null}
      </div>
      {state.message ? <p className={`rounded-2xl px-4 py-3 text-sm font-medium ${state.status === "success" ? "bg-accent/45 text-brand-hover" : "bg-sale/10 text-sale"}`} role="status">{state.message}</p> : null}
      {publicUrl ? (
        <section aria-labelledby="publication-success" className="rounded-2xl border border-success/30 bg-success/10 p-4">
          <h2 className="font-display text-xl font-semibold" id="publication-success">Tu publicación está lista</h2>
          <Link className="mt-3 inline-flex min-h-11 items-center font-semibold text-brand underline underline-offset-4" href={publicUrl}>Ver publicación</Link>
          <div className="mt-3"><ShareActions label="Compartir producto" title={product?.name ?? "tu producto"} url={publicUrl} /></div>
          <Link className="mt-4 inline-flex min-h-11 items-center font-semibold text-brand underline underline-offset-4" href={`/panel/tiendas/${shopId}/productos/nuevo`}>Agregar otro producto</Link>
        </section>
      ) : null}
      {nextRequirement ? <p className="text-sm font-medium text-muted">Siguiente paso: {nextRequirement}</p> : null}
      {uploadedKeys.map((key) => (
        <input key={key} name="image_keys" type="hidden" value={key} />
      ))}
      <ProductActions publishLabel={publishLabel} withdrawLabel={withdrawLabel} blocked={Boolean(imageError)} busy={uploading} status={product?.status} />
    </form>
  );
}
