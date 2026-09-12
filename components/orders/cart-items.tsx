import { ImageIcon, Minus, Plus, Trash2 } from "lucide-react";

import { formatCurrency } from "@/lib/format";
import { DEFAULT_CATALOG_CURRENCY } from "@/lib/catalog-locale";
import type { CartDetail } from "@/lib/queries/orders.types";

export function CartItems({
  items,
  quantityAction,
  removeAction,
  subtotal,
}: {
  items: CartDetail["items"];
  quantityAction: (itemId: number) => (formData: FormData) => Promise<void>;
  removeAction: (itemId: number) => (formData: FormData) => Promise<void>;
  subtotal: number;
}) {
  // One cart holds one shop, so the first priced line names the currency for
  // the whole thing rather than each row answering separately.
  const currencyCode =
    items.find((item) => item.product)?.product?.currency_code ?? DEFAULT_CATALOG_CURRENCY;

  return (
    <div className="rounded-[2rem] border border-line bg-surface p-6">
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li className="flex flex-wrap items-center gap-4 py-5 first:pt-0 last:pb-0" key={item.id}>
            <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-background text-brand/35">
              {item.product?.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className="size-full object-cover" src={item.product.image_url} />
              ) : (
                <ImageIcon aria-hidden="true" className="size-5" />
              )}
            </div>

            {item.product ? (
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{item.product.name}</h2>
                <p className="mt-1 text-sm text-muted">
                  {formatCurrency(item.product.price_mxn, currencyCode)} por unidad
                </p>
                <p className="mt-1 font-semibold">
                  {formatCurrency(item.product.price_mxn * item.quantity, currencyCode)}
                </p>
              </div>
            ) : (
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">Producto no disponible</h2>
                <p className="mt-1 text-sm font-medium text-sale">Ya no disponible</p>
              </div>
            )}

            {/* Their own row on a phone: held beside the name, the stepper and
                the bin squeezed it to one word per line. */}
            <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
              {item.product ? (
                /* Each press is the whole change. A number field needed a second
                   press on an update button, and the edit of anyone who missed
                   it was thrown away without a word. */
                <form action={quantityAction(item.id)} className="flex items-center gap-1">
                  <button
                    aria-label={`Quitar una unidad de ${item.product.name}`}
                    className="tap grid place-items-center rounded-full border border-line text-brand disabled:opacity-40"
                    disabled={item.quantity <= 1}
                    name="quantity"
                    type="submit"
                    value={item.quantity - 1}
                  >
                    <Minus aria-hidden="true" className="size-4" />
                  </button>
                  <span className="min-w-8 text-center font-semibold tabular-nums">{item.quantity}</span>
                  <button
                    aria-label={`Agregar una unidad de ${item.product.name}`}
                    className="tap grid place-items-center rounded-full border border-line text-brand disabled:opacity-40"
                    disabled={item.quantity >= item.product.units_available}
                    name="quantity"
                    type="submit"
                    value={item.quantity + 1}
                  >
                    <Plus aria-hidden="true" className="size-4" />
                  </button>
                </form>
              ) : null}
              <form action={removeAction(item.id)}>
                <button
                  aria-label={
                    item.product
                      ? `Quitar ${item.product.name} del carrito`
                      : "Quitar el producto no disponible del carrito"
                  }
                  className="tap grid place-items-center rounded-full text-sale"
                  type="submit"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex justify-between border-t border-line pt-5 text-lg font-semibold">
        <span>Subtotal</span>
        <span>{formatCurrency(subtotal, currencyCode)}</span>
      </div>
      <p className="mt-2 text-sm text-muted">
        Pago y entrega se coordinan directamente con vendedor después de aceptar pedido.
      </p>
    </div>
  );
}
