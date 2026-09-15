"use client";

import { RotateCw } from "lucide-react";

/**
 * The panel's last line of defence. Expected failures are handled inside the
 * dashboard itself; this only catches what nobody anticipated, and offers the
 * one useful move.
 */
export default function PanelError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <section className="mx-auto max-w-3xl px-5 py-16 sm:px-8" role="alert">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Tu espacio</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em]">No pudimos cargar esta parte del panel</h1>
      <p className="mt-3 leading-7 text-muted">Tus tiendas, productos y pedidos no cambiaron. Vuelve a intentarlo.</p>
      <button
        className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-on-brand"
        onClick={() => retry()}
        type="button"
      >
        <RotateCw aria-hidden="true" className="size-4" />
        Reintentar
      </button>
    </section>
  );
}
