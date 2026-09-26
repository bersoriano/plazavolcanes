"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

import { isLaunchBarRoute } from "@/lib/launch-bar";

/**
 * The bar itself, and the only part that needs the current route.
 *
 * `usePathname` resolves while the server renders too, so the bar is already
 * absent in the HTML on the routes it keeps out of — nothing appears and then
 * vanishes. Everything else it knows was decided on the server.
 *
 * Below sm the full sentence, the link and the close control do not fit on one
 * line at 390px, so a phone reads the short form of the same offer.
 */
export function LaunchBarFrame({
  cap,
  dismissAction,
  spotsLeft,
}: {
  cap: number;
  dismissAction: () => Promise<void>;
  spotsLeft: number | null;
}) {
  const pathname = usePathname();
  if (!isLaunchBarRoute(pathname)) return null;

  return (
    <aside
      aria-label="Promoción de lanzamiento"
      className="bg-brand pt-[env(safe-area-inset-top)] text-[13px] font-semibold text-accent sm:text-sm"
      data-launch-bar
      data-surface="dark"
    >
      <div className="relative mx-auto flex h-10 max-w-[1440px] items-center justify-center gap-2.5 overflow-hidden px-10 tracking-[0.01em] sm:h-11 sm:gap-[18px] sm:px-12">
        <p className="flex min-w-0 items-center gap-2.5 truncate whitespace-nowrap sm:gap-[18px]">
          <span aria-hidden="true">✦</span>
          <span className="sm:hidden">0% comisión · primeras {cap} tiendas</span>
          <span className="hidden sm:inline">0% comisión para las primeras {cap} tiendas</span>
          {spotsLeft === null ? null : (
            <>
              <span aria-hidden="true" className="hidden opacity-50 sm:inline">
                ·
              </span>
              <span className="hidden text-white sm:inline">
                Quedan <span className="tabular-nums">{spotsLeft}</span> lugares fundadores
              </span>
            </>
          )}
        </p>

        <Link
          className="shrink-0 whitespace-nowrap text-white underline underline-offset-[3px] sm:text-accent"
          href="/vender?desde=barra"
        >
          Vender →
        </Link>

        <form action={dismissAction} className="absolute right-2 shrink-0 sm:right-5">
          <button
            aria-label="Cerrar aviso"
            className="tap-halo grid size-6 place-items-center rounded-full text-white/70 transition-colors hover:text-white"
            type="submit"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </form>
      </div>
    </aside>
  );
}
