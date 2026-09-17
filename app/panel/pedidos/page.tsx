import Link from "next/link";
import { ArrowLeft, ChevronRight, PackageOpen, RotateCw } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatOrderStatus } from "@/lib/order-status";
import { getSellerOrderQueue, type SellerOrderRow } from "@/lib/queries/orders.server";
import {
  groupSellerOrders,
  SELLER_STEP_TITLES,
  sellerOrderGuidance,
  URGENCY_LABELS,
  type SellerOrderEntry,
  type SellerOrderGroup,
} from "@/lib/seller-action-queue";

const URGENCY_STYLES = {
  overdue: "bg-sale/15 text-sale",
  due_soon: "bg-accent text-brand",
  none: "",
} as const;

function orderCount(count: number) {
  return `${count} ${count === 1 ? "pedido" : "pedidos"}`;
}

export default async function SellerOrdersPage() {
  const result = await getSellerOrderQueue();
  if (!result) return null;

  return (
    <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand" href="/panel">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Panel
      </Link>
      <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-brand">Ventas</p>
      <h1 className="mt-2 font-display text-4xl font-semibold">Pedidos</h1>

      {result.status === "error" ? (
        <div className="mt-8 rounded-[2rem] border border-line bg-surface p-6 sm:p-8" role="alert">
          <h2 className="font-display text-2xl font-semibold">No pudimos cargar tus pedidos</h2>
          <p className="mt-2 max-w-xl leading-7 text-muted">Tus pedidos no cambiaron; solo falló la consulta. Vuelve a intentarlo en un momento.</p>
          <Link className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-on-brand" href="/panel/pedidos">
            <RotateCw aria-hidden="true" className="size-4" />
            Reintentar
          </Link>
        </div>
      ) : result.orders.length ? (
        <>
          <div className="mt-8 space-y-8">
            {groupSellerOrders(result.orders, result.now).map((group) => (
              <OrderGroup group={group} key={group.id} now={result.now} />
            ))}
          </div>
          <p className="mt-8 text-xs leading-5 text-muted">
            Aún no enviamos avisos por correo ni notificaciones. Los pedidos nuevos aparecen aquí y en tu panel.
          </p>
        </>
      ) : (
        <div className="mt-8">
          <EmptyState
            description="Las solicitudes de compradores aparecerán aquí y en tu panel. Aún no enviamos avisos por correo ni notificaciones."
            icon={<PackageOpen aria-hidden="true" className="size-7" />}
            title="Aún no recibes pedidos"
          />
        </div>
      )}
    </section>
  );
}

function OrderGroup({ group, now }: { group: SellerOrderGroup<SellerOrderRow>; now: Date }) {
  const titleId = `orders-${group.id}`;
  return (
    <section aria-labelledby={titleId}>
      <h2 className="flex flex-wrap items-center gap-2 font-display text-2xl font-semibold" id={titleId}>
        {group.title}
        <span className="sr-only">,</span>{" "}
        <span className="rounded-full bg-accent px-3 py-0.5 font-sans text-sm text-brand">{orderCount(group.orders.length)}</span>
      </h2>
      {group.orders.length ? (
        <ul className="mt-4 space-y-4">
          {group.orders.map((order) => (
            <li key={order.id}>
              <OrderRow now={now} order={order} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">Nada pendiente por ahora.</p>
      )}
    </section>
  );
}

function OrderRow({ order, now }: { order: SellerOrderEntry<SellerOrderRow>; now: Date }) {
  const { step } = order;
  const guidance = sellerOrderGuidance(order, now);
  // The seller's turn reads as an instruction; the buyer's as what they still
  // owe; history as the status it ended in.
  const next =
    step.owner === "seller" ? SELLER_STEP_TITLES[step.kind] : step.owner === "buyer" ? guidance.title : formatOrderStatus(order.status, order.fulfillment_method);
  const urgencyLabel = URGENCY_LABELS[order.urgency];

  return (
    <Link className="group flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-brand" href={`/panel/pedidos/${order.id}`}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-brand">
          Pedido #{order.id} · {order.shop.name}
        </p>
        <p className="mt-1 text-lg font-semibold text-ink">{next}</p>
        {step.owner === "seller" && guidance.deadline ? (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {urgencyLabel ? <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${URGENCY_STYLES[order.urgency]}`}>{urgencyLabel}</span> : null}
            <time className={order.urgency === "overdue" ? "font-semibold text-sale" : "text-muted"} dateTime={guidance.deadline.dateTime}>
              {guidance.deadline.label}
            </time>
          </p>
        ) : null}
        <p className="mt-1 text-sm text-muted">Recibido el {formatDate(order.created_at)}</p>
      </div>
      <div className="flex items-center gap-3 text-right">
        <div>
          <p className="font-semibold">{formatCurrency(order.subtotal, order.currency_code)}</p>
          <p className="mt-1 text-sm text-muted">
            <span className="rounded-full bg-background px-2.5 py-0.5">{order.fulfillment_method === "pickup" ? "Recolección" : "Envío"}</span>
          </p>
        </div>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-brand transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
