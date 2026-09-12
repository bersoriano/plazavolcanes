import { Trash2 } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { DeliveryPolicyForm } from "@/components/shops/delivery-policy-form";
import { ShopForm } from "@/components/shops/shop-form";
import { ShopWorkspaceHeader } from "@/components/shops/shop-workspace-header";
import { deleteShop, updateDeliveryPolicy, updateShop } from "@/lib/actions/shops";
import {
  deliveryPolicyUnlocksAt,
  isDeliveryPolicyEditable,
} from "@/lib/delivery-policy";
import { PICKUP_POINT_READ_ERROR } from "@/lib/queries/checkout";
import { getOwnedShop } from "@/lib/queries/shops.server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MEDIA_WIDTHS, mediaUrls } from "@/lib/media/url";

export default async function ShopSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) redirect("/panel");
  const { id } = await params;
  const shopId = Number(id);
  if (!Number.isSafeInteger(shopId) || shopId < 1) notFound();

  const shop = await getOwnedShop(shopId);
  if (!shop) notFound();

  const supabase = await createServerSupabaseClient();
  const { data: pickupPoint, error: pickupPointError } = await supabase
    .from("shop_pickup_points")
    .select("address_line1, locality, administrative_area_code, postal_code, notes")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (pickupPointError) throw new Error(PICKUP_POINT_READ_ERROR);

  const imageUrls = mediaUrls([shop.image_path], { width: MEDIA_WIDTHS.thumbnail });
  const updateAction = updateShop.bind(null, shopId);
  const deleteAction = deleteShop.bind(null, shopId);
  const deliveryPolicyAction = updateDeliveryPolicy.bind(null, shopId);
  // The database decides this, and refuses a change either way; the panel reads
  // the same clock so the seller sees a shut field instead of a rejected save.
  const deliveryPolicyUnlocksOn = isDeliveryPolicyEditable(shop.delivery_policy_updated_at)
    ? null
    : (deliveryPolicyUnlocksAt(shop.delivery_policy_updated_at)?.toISOString() ?? null);

  return (
    <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <ShopWorkspaceHeader active="ajustes" shopId={shopId} shopName={shop.name} shopSlug={shop.slug} />

      {/* Narrower than the catalogue on purpose: this is a column of fields to
          read down, not a list to scan across. */}
      <section aria-labelledby="ajustes-title" className="rounded-[2rem] border border-line bg-surface p-6 sm:p-8">
        <h2 className="font-display text-2xl font-semibold" id="ajustes-title">Editar tienda</h2>
        <p className="mb-7 mt-2 text-muted">Mantén clara la historia de tu tienda.</p>
        <ShopForm
          action={updateAction}
          pickupPoint={pickupPoint ? {
            addressLine1: pickupPoint.address_line1,
            locality: pickupPoint.locality,
            administrativeAreaCode: pickupPoint.administrative_area_code,
            postalCode: pickupPoint.postal_code,
            notes: pickupPoint.notes ?? "",
          } : null}
          shop={{
            name: shop.name,
            description: shop.description,
            imageUrl: shop.image_path ? (imageUrls.get(shop.image_path) ?? null) : null,
            countryCode: shop.country_code,
            administrativeAreaCodes: shop.administrative_area_codes ?? [],
          }}
        />

        {/* Its own form, next to the shop's: the delivery policy is saved by
            its own button because it may only change once a month. */}
        <section aria-labelledby="delivery-policy-title" className="mt-8 border-t border-line pt-6">
          <h3 className="font-display text-xl font-semibold" id="delivery-policy-title">Entregas</h3>
          <div className="mt-4">
            <DeliveryPolicyForm
              action={deliveryPolicyAction}
              policy={shop.delivery_policy ?? ""}
              unlocksAt={deliveryPolicyUnlocksOn}
            />
          </div>
        </section>

        <details className="mt-8 border-t border-line pt-6">
          <summary className="tap inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-sale">
            <Trash2 aria-hidden="true" className="size-4" />
            Eliminar tienda
          </summary>
          <div className="mt-4 rounded-2xl bg-sale/10 p-4">
            <p className="text-sm leading-6 text-ink">Se eliminarán también todos sus productos e imágenes. Esta acción no se puede deshacer.</p>
            <form action={deleteAction} className="mt-3">
              <button className="tap inline-flex items-center rounded-full bg-sale px-4 py-2 text-sm font-semibold text-white" type="submit">Confirmar eliminación</button>
            </form>
          </div>
        </details>
      </section>
    </section>
  );
}
