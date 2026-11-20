"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

import { Copos } from "@/components/navidad/adornos";
import { Button } from "@/components/ui/button";
import { NAVIDAD_ACTIVA } from "@/lib/navidad";
import { isLaunchBarRoute } from "@/lib/launch-bar";

/**
 * The bar itself, and the only part that needs the current route.
 *
 * `usePathname` resolves while the server renders too, so the bar is already
 * absent in the HTML on the routes it keeps out of — nothing appears and then
 * vanishes. Everything else it knows was decided on the server.
 *
 * Below sm the full sentence, the link and the close control do not fit on one
 * line at 390px, so a phone reads the short form of the same offer. The bar is
 * 44px at every width (the mockup's phone bar is 40): its link fills the bar's
 * height, and 40 would leave it short of a 44px target.
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
  // The Christmas flakes belong to the landing (components/navidad).
  const navidad = NAVIDAD_ACTIVA && pathname === "/";

  return (
    <aside
      aria-label="Promoción de lanzamiento"
      className={`bg-brand pt-[env(safe-area-inset-top)] text-[13px] font-semibold text-accent sm:text-sm${navidad ? " nv-anclaje" : ""}`}
      data-launch-bar
      data-surface="dark"
    >
      <div className="relative mx-auto flex h-11 max-w-[1440px] items-center justify-center gap-2.5 overflow-hidden px-10 tracking-[0.01em] sm:gap-[18px] sm:px-12">
        <p className="flex min-w-0 items-center gap-2.5 truncate whitespace-nowrap sm:gap-[18px]">
          <span aria-hidden="true">✦</span>
          <span className="sm:hidden">Primeras {cap} tiendas: 50 productos</span>
          <span className="hidden sm:inline">
            Primeras {cap} tiendas: 50 productos, insignia fundadora y 0% comisión fija 12 meses
          </span>
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
          className="inline-flex h-11 shrink-0 items-center whitespace-nowrap text-white underline underline-offset-[3px] sm:text-accent"
          href="/vender?desde=barra"
        >
          Vender →
        </Link>

        <form action={dismissAction} className="absolute right-2 shrink-0 sm:right-5">
          <Button
            variant="unstyled"
            aria-label="Cerrar aviso"
            className="tap-halo grid size-6 place-items-center rounded-full text-white/70 transition-colors hover:text-white"
            type="submit"
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </form>
      </div>

      {navidad ? (
        // The bar does not clip: every flake stays left of 90%.
        <Copos
          copos={[
            { src: "copo-lima.svg", left: "3%", top: "20%", opacity: 0.2 },
            { src: "copo-lima.svg", left: "28%", top: "4%", opacity: 0.14 },
            { src: "copo-lima.svg", left: "64%", top: "30%", opacity: 0.18 },
            { src: "copo-lima.svg", left: "88%", top: "8%", opacity: 0.15 },
          ]}
        />
      ) : null}
    </aside>
  );
}
