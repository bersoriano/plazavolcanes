"use client";

import { RotateCw } from "lucide-react";

import { pageContainer } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

/**
 * The panel's last line of defence. Expected failures are handled inside the
 * dashboard itself; this only catches what nobody anticipated, and offers the
 * one useful move.
 */
export default function PanelError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <section className={`${pageContainer} py-16`} role="alert">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Tu espacio</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em]">No pudimos cargar esta parte del panel</h1>
      <p className="mt-3 leading-7 text-muted">Tus tiendas, productos y pedidos no cambiaron. Vuelve a intentarlo.</p>
      <Button
        className="mt-6 min-h-11 bg-brand px-5 py-3 text-sm text-on-brand"
        onClick={() => retry()}
        type="button"
      >
        <RotateCw aria-hidden="true" className="size-4" />
        Reintentar
      </Button>
    </section>
  );
}
