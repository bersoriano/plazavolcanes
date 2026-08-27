import Link from "next/link";

import { VolcanoMark } from "@/components/brand/volcano-mark";
import { LEGAL_ROUTES } from "@/lib/legal/document-types";

export function SiteFooter() {
  return (
    <footer className="overflow-hidden bg-brand text-white" data-site-footer>
      <div className="relative mx-auto flex max-w-[1440px] flex-col gap-10 px-5 py-12 sm:px-8 lg:flex-row lg:justify-between lg:px-12">
        <VolcanoMark className="absolute -bottom-20 left-1/2 w-[720px] -translate-x-1/2 text-white/5" />
        <div className="relative">
          <p className="font-display text-2xl font-semibold">Plaza Volcanes</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-white/70">
            Un punto de encuentro para tiendas independientes y personas curiosas.
          </p>
        </div>
        <div className="relative flex flex-col gap-8 sm:flex-row sm:gap-16">
          <nav aria-label="Navegación" className="flex flex-col gap-3 text-sm font-medium text-white/80">
            <Link className="hover:text-accent" href="/">Explorar</Link>
            <Link className="hover:text-accent" href="/registro">Crear tienda</Link>
            <Link className="hover:text-accent" href="/ingresar">Ingresar</Link>
          </nav>
          <nav aria-label="Información legal" className="flex flex-col gap-3 text-sm font-medium text-white/80">
            {LEGAL_ROUTES.map((route) => (
              <Link className="hover:text-accent" href={route.path} key={route.path}>
                {route.navLabel}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div className="border-t border-white/10 px-5 py-5 text-center text-xs text-white/55">
        © 2026 Plaza Volcanes
      </div>
    </footer>
  );
}
