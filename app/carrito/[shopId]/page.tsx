import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { notFound } from "next/navigation";

import { CheckoutForm } from "@/components/orders/checkout-form";
import { EmptyState } from "@/components/ui/empty-state";
import { checkoutCart, removeCartItem, setCartItemQuantity } from "@/lib/actions/cart";
import { formatMxn } from "@/lib/format";
import { getCart } from "@/lib/queries/orders.server";

export default async function CartPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId: rawShopId } = await params;
  const shopId = Number(rawShopId);
  if (!Number.isSafeInteger(shopId) || shopId < 1) notFound();
  const cart = await getCart(shopId);
  const checkoutAction = checkoutCart.bind(null, shopId);

  return <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-brand" href={cart ? `/tiendas/${cart.shop.slug}` : "/"}><ArrowLeft aria-hidden="true" className="size-4" />Seguir explorando</Link><div className="mt-7"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Solicitud de compra</p><h1 className="mt-2 font-display text-4xl font-semibold">{cart ? `Carrito de ${cart.shop.name}` : "Tu carrito"}</h1></div>{cart?.items.length ? <div className="mt-8 grid gap-7 lg:grid-cols-[1fr_420px]"><div className="rounded-[2rem] border border-line bg-surface p-6"><ul className="divide-y divide-line">{cart.items.map((item) => { const quantityAction = setCartItemQuantity.bind(null, item.id); const removeAction = removeCartItem.bind(null, item.id); return <li className="flex flex-wrap items-center justify-between gap-4 py-5 first:pt-0 last:pb-0" key={item.id}><div><h2 className="font-semibold">{item.product.name}</h2><p className="mt-1 text-sm text-muted">{formatMxn(item.product.price_mxn)} por unidad</p></div><div className="flex items-center gap-3"><form action={quantityAction}><input aria-label={`Cantidad de ${item.product.name}`} className="w-20 rounded-xl border border-line px-3 py-2" defaultValue={item.quantity} max="99" min="1" name="quantity" type="number" /><button className="ml-2 text-sm font-semibold text-brand" type="submit">Actualizar</button></form><form action={removeAction}><button className="text-sm font-semibold text-sale" type="submit">Quitar</button></form></div></li>; })}</ul><div className="mt-6 flex justify-between border-t border-line pt-5 text-lg font-semibold"><span>Subtotal</span><span>{formatMxn(cart.subtotal)}</span></div><p className="mt-2 text-sm text-muted">Pago y entrega se coordinan directamente con vendedor después de aceptar pedido.</p></div><aside className="rounded-[2rem] border border-line bg-surface p-6"><h2 className="font-display text-2xl font-semibold">Dirección de entrega</h2><p className="mb-5 mt-2 text-sm leading-6 text-muted">Solo vendedor de esta tienda y tú podrán verla.</p><CheckoutForm action={checkoutAction} idempotencyKey={crypto.randomUUID()} /></aside></div> : <div className="mt-8"><EmptyState icon={<ShoppingBag aria-hidden="true" className="size-7" />} title="Tu carrito está vacío" description="Agrega productos publicados para crear una solicitud." /></div>}</section>;
}
