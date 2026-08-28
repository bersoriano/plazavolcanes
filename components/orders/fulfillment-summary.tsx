import type { PickupPoint } from "@/lib/queries/checkout";
import { MEXICO_ADMINISTRATIVE_AREAS } from "@/lib/shop-location";
import type { OrderDetail } from "@/lib/queries/orders.types";

function areaName(code: string) {
  return MEXICO_ADMINISTRATIVE_AREAS.find((area) => area.code === code)?.label ?? code;
}

/**
 * How this order gets to its buyer.
 *
 * A collected order has no address of its own — the address belongs to the shop,
 * and `shop_pickup_point` hands over the street only once the seller has accepted.
 * Until then this shows the city, and says why.
 */
export function FulfillmentSummary({
  altContact,
  address,
  fulfillmentMethod,
  pickupPoint,
}: {
  altContact: { name: string; phone: string | null; note: string | null } | null;
  address: OrderDetail["address"];
  fulfillmentMethod: "pickup" | "shipping";
  pickupPoint: PickupPoint | null;
}) {
  return (
    <div className="rounded-[2rem] border border-line bg-surface p-6">
      <h2 className="font-display text-xl font-semibold">
        {fulfillmentMethod === "pickup" ? "Recolección en tienda" : "Envío a domicilio"}
      </h2>

      {fulfillmentMethod === "shipping" ? (
        address?.redacted_at ? (
          <p className="mt-3 text-sm text-muted">Dirección eliminada según política de retención.</p>
        ) : (
          <address className="mt-3 not-italic leading-7 text-muted">
            <span className="block">{address?.recipient}</span>
            <span className="block">
              {address?.address_line1}
              {address?.address_line2 ? `, ${address.address_line2}` : ""}
            </span>
            <span className="block">
              {address?.locality}, {address?.administrative_area} {address?.postal_code}
            </span>
            <span className="block">{address?.country_code}</span>
          </address>
        )
      ) : pickupPoint ? (
        <div className="mt-3 leading-7 text-muted">
          {pickupPoint.address_line1 ? (
            <address className="not-italic">
              <span className="block">{pickupPoint.address_line1}</span>
              <span className="block">
                {pickupPoint.locality}, {areaName(pickupPoint.administrative_area_code)}{" "}
                {pickupPoint.postal_code}
              </span>
              {pickupPoint.notes ? (
                <span className="block">{pickupPoint.notes}</span>
              ) : null}
            </address>
          ) : (
            <>
              <p className="font-semibold text-ink">
                {pickupPoint.locality}, {areaName(pickupPoint.administrative_area_code)}
              </p>
              <p className="mt-1 text-sm">
                Verás la dirección completa cuando el vendedor acepte tu pedido.
              </p>
            </>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">
          El punto de recolección se acuerda en la conversación.
        </p>
      )}

      {altContact ? (
        <div className="mt-5 border-t border-line pt-4 text-sm leading-6">
          <p className="font-semibold text-ink">
            {fulfillmentMethod === "pickup" ? "Recoge" : "Recibe"}: <span>{altContact.name}</span>
          </p>
          {altContact.phone ? <p className="text-muted">{altContact.phone}</p> : null}
          {altContact.note ? <p className="text-muted">{altContact.note}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
