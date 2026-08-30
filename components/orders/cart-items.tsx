import { formatMxn } from "@/lib/format";
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
  return (
    <div className="rounded-[2rem] border border-line bg-surface p-6">
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li className="flex flex-wrap items-center justify-between gap-4 py-5 first:pt-0 last:pb-0" key={item.id}>
            {item.product ? (
              <div>
                <h2 className="font-semibold">{item.product.name}</h2>
                <p className="mt-1 text-sm text-muted">{formatMxn(item.product.price_mxn)} por unidad</p>
              </div>
            ) : (
              <div>
                <h2 className="font-semibold">Producto no disponible</h2>
                <p className="mt-1 text-sm font-medium text-sale">Ya no disponible</p>
              </div>
            )}
            <div className="flex items-center gap-3">
              {item.product ? (
                <form action={quantityAction(item.id)}>
                  <input aria-label={`Cantidad de ${item.product.name}`} className="w-20 rounded-xl border border-line px-3 py-2" defaultValue={item.quantity} max="99" min="1" name="quantity" type="number" />
                  <button className="ml-2 text-sm font-semibold text-brand" type="submit">Actualizar</button>
                </form>
              ) : null}
              <form action={removeAction(item.id)}>
                <button className="text-sm font-semibold text-sale" type="submit">Quitar</button>
              </form>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex justify-between border-t border-line pt-5 text-lg font-semibold">
        <span>Subtotal</span>
        <span>{formatMxn(subtotal)}</span>
      </div>
      <p className="mt-2 text-sm text-muted">
        Pago y entrega se coordinan directamente con vendedor después de aceptar pedido.
      </p>
    </div>
  );
}
