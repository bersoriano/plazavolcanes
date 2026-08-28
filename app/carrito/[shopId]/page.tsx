import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { notFound } from "next/navigation";

import { BuyerPanel } from "@/components/orders/buyer-panel";
import { CartItems } from "@/components/orders/cart-items";
import { CartThreads } from "@/components/orders/cart-thread";
import { FulfillmentChoice } from "@/components/orders/fulfillment-choice";
import { ShopPanel } from "@/components/orders/shop-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { checkoutCart, removeCartItem, setCartItemQuantity } from "@/lib/actions/cart";
import { sendMessage } from "@/lib/actions/messages";
import { openConversation } from "@/lib/actions/start-conversation";
import { getPublicShop } from "@/lib/queries/catalog.server";
import { fetchBuyerProfile, fetchCartThreads, fetchPickupPoint } from "@/lib/queries/checkout.server";
import { getCart } from "@/lib/queries/orders.server";

export default async function CartPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId: rawShopId } = await params;
  const shopId = Number(rawShopId);
  if (!Number.isSafeInteger(shopId) || shopId < 1) notFound();

  const cart = await getCart(shopId);
  const backHref = cart ? `/tiendas/${cart.shop.slug}` : "/";

  if (!cart?.items.length) {
    return (
      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <Link className="inline-flex items-center gap-2 text-sm font-semibold text-brand" href={backHref}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          Seguir explorando
        </Link>
        <div className="mt-8">
          <EmptyState
            icon={<ShoppingBag aria-hidden="true" className="size-7" />}
            title="Tu carrito está vacío"
            description="Agrega productos publicados para crear una solicitud."
          />
        </div>
      </section>
    );
  }

  const cartPath = `/carrito/${shopId}`;
  const [buyer, pickupPoint, threads, shop] = await Promise.all([
    fetchBuyerProfile(),
    fetchPickupPoint(shopId),
    fetchCartThreads(
      shopId,
      cart.items.map((item) => ({ productId: item.product.id, productName: item.product.name })),
    ),
    getPublicShop(cart.shop.slug),
  ]);

  const checkoutAction = checkoutCart.bind(null, shopId);
  const sendAction = (conversationId: number) =>
    sendMessage.bind(null, conversationId, [cartPath, `/mensajes/${conversationId}`, "/mensajes"]);
  const startAction = (productId: number) => openConversation.bind(null, shopId, productId, cartPath);

  return (
    <section className="mx-auto max-w-[86rem] px-5 py-10 sm:px-8 sm:py-14">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-brand" href={backHref}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        Seguir explorando
      </Link>

      <div className="mt-7">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Solicitud de compra</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">Carrito de {cart.shop.name}</h1>
      </div>

      {/* Below lg the columns stack as item, shop, buyer, thread: what is being
          bought first, who is selling it next, then the form and the chat. */}
      <div className="mt-8 grid gap-7 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)_minmax(0,320px)] lg:items-start">
        <div className="contents lg:block lg:space-y-7">
          {buyer ? (
            <div className="order-3 lg:order-none">
              <BuyerPanel buyer={buyer} />
            </div>
          ) : null}
          <div className="order-3 rounded-[2rem] border border-line bg-surface p-6 lg:order-none">
            <h2 className="font-display text-2xl font-semibold">Entrega</h2>
            <div className="mt-5">
              <FulfillmentChoice
                action={checkoutAction}
                idempotencyKey={crypto.randomUUID()}
                pickupPoint={pickupPoint}
                threadHref="#conversacion"
              />
            </div>
          </div>
        </div>

        <div className="contents lg:block lg:space-y-7">
          <div className="order-1 lg:order-none">
            <CartItems
              items={cart.items}
              quantityAction={(itemId) => setCartItemQuantity.bind(null, itemId)}
              removeAction={(itemId) => removeCartItem.bind(null, itemId)}
              subtotal={cart.subtotal}
            />
          </div>

          <div className="order-4 rounded-[2rem] border border-line bg-surface p-6 lg:order-none" id="conversacion">
            <h2 className="font-display text-2xl font-semibold">Conversación</h2>
            {buyer ? (
              <>
                <div className="mt-5 hidden lg:block">
                  <CartThreads currentUserId={buyer.userId} sendAction={sendAction} startAction={startAction} threads={threads} />
                </div>
                <details className="mt-5 lg:hidden">
                  <summary className="cursor-pointer text-sm font-semibold text-brand">Ver mensajes</summary>
                  <div className="mt-4">
                    <CartThreads currentUserId={buyer.userId} sendAction={sendAction} startAction={startAction} threads={threads} />
                  </div>
                </details>
              </>
            ) : null}
          </div>
        </div>

        <div className="contents lg:block">
          <div className="order-2 lg:order-none">
            {shop ? (
              <ShopPanel
                shop={{
                  name: shop.name,
                  slug: shop.slug,
                  imageUrl: shop.imageUrl,
                  trustTier: shop.trust_tier,
                  trustMetrics: shop.trust_metrics,
                  locality: pickupPoint?.locality ?? null,
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
