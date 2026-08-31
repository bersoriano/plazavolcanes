"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import {
  pickupPointFrom,
  pickupValidationError,
  savePickupPoint,
} from "@/lib/actions/shop-pickup-point";
import { uniqueShopSlug } from "@/lib/slug";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { shopImageKey } from "@/lib/media/keys";
import { sniffImageType } from "@/lib/media/signature";
import { shopImageKeys } from "@/lib/media/product-images";
import { deleteObjects, putObject } from "@/lib/media/store";
import { validateImage } from "@/lib/media/validation";
import { shopSchema } from "@/lib/validation/shop";

const authError: ActionState = {
  status: "error",
  message: "Tu sesión terminó. Ingresa nuevamente.",
};

function shopInputFrom(formData: FormData) {
  return {
    name: formData.get("name"),
    description: formData.get("description"),
    country_code: formData.get("country_code"),
    // Both state selects share a field name; the optional one submits "" when unused.
    administrative_area_codes: formData
      .getAll("administrative_area_codes")
      .filter((value) => typeof value === "string" && value.length > 0),
  };
}

function imageFrom(formData: FormData) {
  const value = formData.get("image");
  return value instanceof File && value.size > 0 ? value : null;
}

async function getAuthenticatedContext() {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  return userId ? { supabase, userId } : null;
}

export async function createShop(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = shopSchema.safeParse(shopInputFrom(formData));
  const image = imageFrom(formData);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisa los campos marcados.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  if (image) {
    const imageError = validateImage(image);
    if (imageError) {
      return { status: "error", message: imageError, errors: { image: [imageError] } };
    }
  }

  // The shop row must exist before a pickup point can reference it, so its
  // insert necessarily comes first below — but bad pickup input is rejected
  // here, before that insert, so a mistyped postal code never leaves a
  // pickup-less shop behind for the seller to accidentally duplicate.
  const pickup = pickupPointFrom(formData);
  if (pickup.offered && !pickup.parsed?.success) {
    return pickupValidationError(pickup.parsed);
  }

  const context = await getAuthenticatedContext();
  if (!context) return authError;

  const { supabase, userId } = context;
  const slug = await uniqueShopSlug(parsed.data.name, async (candidate) => {
    const { data } = await supabase
      .from("shops")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    return Boolean(data);
  });
  let imagePath: string | null = null;

  if (image) {
    // The declared type is only a claim; the stored type comes from the bytes.
    const contentType = await sniffImageType(image);
    if (!contentType) {
      const message = "Usa una imagen JPEG, PNG o WebP.";
      return { status: "error", message, errors: { image: [message] } };
    }

    imagePath = shopImageKey(userId, contentType);
    if (!(await putObject(supabase, imagePath, image, contentType))) {
      return { status: "error", message: "No pudimos subir la imagen." };
    }
  }

  const { data, error } = await supabase
    .from("shops")
    .insert({ ...parsed.data, slug, owner_id: userId, image_path: imagePath })
    .select("id, slug")
    .single();

  if (error || !data) {
    if (imagePath) await deleteObjects(supabase, [imagePath]);
    if (
      error?.code === "P0001" &&
      error.message === "Alcanzaste el límite de tiendas."
    ) {
      return {
        status: "error",
        message:
          "Alcanzaste el límite de tiendas. Contacta a administración si necesitas otra.",
      };
    }
    return { status: "error", message: "No pudimos crear la tienda." };
  }

  // Pickup input is already known valid at this point, so the only way this
  // fails now is a genuine database error — the shop itself is created, so
  // the message must say so rather than implying nothing was saved.
  const pickupError = await savePickupPoint(supabase, data.id, formData);
  if (pickupError) {
    return {
      status: "error",
      message:
        "Creamos tu tienda, pero no pudimos guardar la recolección. Agrégala editando la tienda.",
    };
  }

  revalidatePath("/");
  revalidatePath("/panel");
  revalidatePath(`/tiendas/${data.slug}`);
  redirect(`/panel/tiendas/${data.id}?creada=1`);
}

export async function updateShop(
  shopId: number,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = shopSchema.safeParse(shopInputFrom(formData));
  const image = imageFrom(formData);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisa los campos marcados.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  if (image) {
    const imageError = validateImage(image);
    if (imageError) {
      return { status: "error", message: imageError, errors: { image: [imageError] } };
    }
  }

  const context = await getAuthenticatedContext();
  if (!context) return authError;
  const { supabase, userId } = context;
  const { data: existing } = await supabase
    .from("shops")
    .select("slug, image_path")
    .eq("id", shopId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (!existing) {
    return { status: "error", message: "No encontramos esa tienda." };
  }

  const pickupError = await savePickupPoint(supabase, shopId, formData);
  if (pickupError) return pickupError;

  let nextImagePath = existing.image_path;
  if (image) {
    const contentType = await sniffImageType(image);
    if (!contentType) {
      const message = "Usa una imagen JPEG, PNG o WebP.";
      return { status: "error", message, errors: { image: [message] } };
    }

    nextImagePath = shopImageKey(userId, contentType);
    if (!(await putObject(supabase, nextImagePath, image, contentType))) {
      return { status: "error", message: "No pudimos subir la imagen." };
    }
  }

  const { error } = await supabase
    .from("shops")
    .update({
      ...parsed.data,
      image_path: nextImagePath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", shopId)
    .eq("owner_id", userId);

  if (error) {
    if (image && nextImagePath) await deleteObjects(supabase, [nextImagePath]);
    return { status: "error", message: "No pudimos guardar los cambios." };
  }

  if (image && existing.image_path && nextImagePath !== existing.image_path) {
    await deleteObjects(supabase, [existing.image_path]);
  }

  revalidatePath("/");
  revalidatePath("/panel");
  revalidatePath(`/panel/tiendas/${shopId}`);
  revalidatePath(`/tiendas/${existing.slug}`);
  return { status: "success", message: "Tienda actualizada." };
}

export async function deleteShop(shopId: number) {
  const context = await getAuthenticatedContext();
  if (!context) redirect("/ingresar");

  const { supabase, userId } = context;
  const { data: shop } = await supabase
    .from("shops")
    .select("slug, image_path")
    .eq("id", shopId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (!shop) redirect("/panel");

  // Collected before the delete, because the cascade takes product_images with it.
  const keys = await shopImageKeys(supabase, shopId, shop.image_path);
  const { error } = await supabase
    .from("shops")
    .delete()
    .eq("id", shopId)
    .eq("owner_id", userId);

  if (!error) await deleteObjects(supabase, keys);

  revalidatePath("/");
  revalidatePath("/panel");
  revalidatePath(`/tiendas/${shop.slug}`);
  redirect("/panel");
}
