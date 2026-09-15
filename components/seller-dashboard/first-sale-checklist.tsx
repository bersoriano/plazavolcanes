import Link from "next/link";
import { CheckCircle2, Circle, CircleHelp, Lightbulb } from "lucide-react";

import { ShareActions } from "@/components/share/share-actions";
import type { ChecklistStep, FirstSaleChecklist as Checklist } from "@/lib/seller-dashboard";

const STATE_ICON = {
  done: { icon: CheckCircle2, className: "text-success", label: "Hecho" },
  todo: { icon: Circle, className: "text-muted", label: "Pendiente" },
  suggestion: { icon: Lightbulb, className: "text-brand", label: "Recomendado" },
  unknown: { icon: CircleHelp, className: "text-muted", label: "Sin confirmar" },
} as const;

/**
 * The road from an empty account to a first sale, read from what happened.
 *
 * Every tick is derived — a shop exists, three listings are complete and on
 * view, a delivery policy is written, a buyer got an answer, an order was
 * completed — so reloading the page can only ever show the truth. Sharing is
 * the exception: nothing observable proves it, so it stays a suggestion with
 * the share controls attached and is left out of the count.
 */
export function FirstSaleChecklist({
  checklist,
  shops,
  focusShopId,
  shareUrl,
}: {
  checklist: Checklist;
  shops: { id: number; name: string }[];
  focusShopId: number | null;
  /** Present only once the focused shop has something a visitor can see. */
  shareUrl: string | null;
}) {
  const percent = checklist.total ? Math.round((checklist.completed / checklist.total) * 100) : 0;

  return (
    <section aria-labelledby="checklist-title" className="rounded-[2rem] border border-line bg-surface p-5 sm:p-7">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Tu primera venta</p>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-2xl font-semibold tracking-[-0.02em]" id="checklist-title">
          {checklist.shop ? `Prepara ${checklist.shop.name}` : "Empieza a vender"}
        </h2>
        <span className="text-sm font-semibold text-muted">
          {checklist.completed} de {checklist.total} pasos
        </span>
      </div>
      <div
        aria-label={`${checklist.completed} de ${checklist.total} pasos completados`}
        aria-valuemax={checklist.total}
        aria-valuemin={0}
        aria-valuenow={checklist.completed}
        className="mt-3 h-2 overflow-hidden rounded-full bg-background"
        role="progressbar"
      >
        <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
      </div>

      {shops.length > 1 ? (
        <nav aria-label="Tienda que sigue la guía" className="mt-4 flex flex-wrap gap-2">
          {shops.map((shop) => {
            const isCurrent = shop.id === focusShopId;
            return (
              <Link
                aria-current={isCurrent ? "true" : undefined}
                className={`tap inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-semibold transition-colors ${
                  isCurrent ? "border-brand bg-brand text-on-brand" : "border-line bg-background text-brand hover:border-brand"
                }`}
                href={`/panel?tienda=${shop.id}`}
                key={shop.id}
                scroll={false}
              >
                {shop.name}
              </Link>
            );
          })}
        </nav>
      ) : null}

      <ol className="mt-5 space-y-1">
        {checklist.steps.map((step) => (
          <Step key={step.id} shareUrl={shareUrl} shopName={checklist.shop?.name ?? null} step={step} />
        ))}
      </ol>
    </section>
  );
}

function Step({ step, shareUrl, shopName }: { step: ChecklistStep; shareUrl: string | null; shopName: string | null }) {
  const state = STATE_ICON[step.state];
  const Icon = state.icon;

  return (
    <li className="flex gap-3 rounded-2xl px-1 py-3">
      <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${state.className}`} />
      <div className="min-w-0 flex-1">
        <p className={`font-semibold ${step.state === "done" ? "text-muted" : "text-ink"}`}>
          {step.title}
          <span className="sr-only"> ({state.label})</span>
          {step.state === "suggestion" ? (
            <span className="ml-2 rounded-full bg-accent px-2 py-0.5 align-middle text-xs font-bold text-brand-hover">Recomendado</span>
          ) : null}
        </p>
        <p className="mt-1 text-sm leading-6 text-muted">
          {step.id === "share" && !shareUrl
            ? "Cuando tengas un producto a la vista, podrás compartir el enlace de tu tienda desde aquí."
            : step.detail}
        </p>
        {step.id === "share" && shareUrl && shopName ? (
          <div className="mt-3">
            <ShareActions label={`Compartir ${shopName}`} title={shopName} url={shareUrl} />
          </div>
        ) : null}
        {step.action ? (
          <Link
            className="tap mt-2 inline-flex items-center text-sm font-semibold text-brand underline decoration-accent decoration-4 underline-offset-4"
            href={step.action.href}
          >
            {step.action.label}
          </Link>
        ) : null}
      </div>
    </li>
  );
}
