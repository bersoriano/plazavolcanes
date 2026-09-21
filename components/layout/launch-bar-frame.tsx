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
      className="bg-brand pt-[env(safe-area-inset-top)] text-sm text-white"
      data-launch-bar
    >
      <div className="mx-auto flex h-10 max-w-[1440px] items-center gap-3 overflow-hidden px-3 sm:px-8 lg:px-12">
        <p className="flex min-w-0 flex-1 items-center gap-1.5 truncate whitespace-nowrap">
          <span className="sm:hidden">
            <span className="font-semibold text-accent">0% comisión</span> · primeras {cap} tiendas
          </span>
          <span className="hidden sm:inline">
            <span className="font-semibold text-accent">0% comisión</span> para las primeras {cap}{" "}
            tiendas
            {spotsLeft === null ? null : (
              <>
                {" · "}
                Quedan <span className="font-semibold text-accent tabular-nums">{spotsLeft}</span>{" "}
                lugares
              </>
            )}
          </span>
        </p>

        <Link
          className="shrink-0 whitespace-nowrap font-semibold text-accent underline decoration-accent/50 underline-offset-4"
          href="/vender?desde=barra"
        >
          Vender →
        </Link>

        <form action={dismissAction} className="shrink-0">
          <button
            aria-label="Cerrar aviso"
            className="tap-halo -mr-1 grid size-6 place-items-center rounded-full text-white/70 transition-colors hover:text-white"
            type="submit"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </form>
      </div>
    </aside>
  );
}
