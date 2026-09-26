import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { VolcanoMark } from "@/components/brand/volcano-mark";
import { LEGAL_ROUTES } from "@/lib/legal/document-types";

const LINK = "inline-flex min-h-11 items-center whitespace-nowrap text-white transition-colors hover:text-accent";
const LABEL = "text-[11px] font-bold uppercase tracking-[0.14em] text-accent lg:text-[12px]";

/**
 * The site's footer: the brand, the plaza's own links and the legal shelf,
 * then a giant lime wordmark cropped by the bottom edge. The wordmark is
 * decoration; the brand is already named at the top.
 */
export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-brand text-white" data-site-footer data-surface="dark">
      <div className="relative mx-auto flex max-w-[1440px] flex-col gap-8 px-5 pb-[190px] pt-14 sm:px-8 lg:gap-12 lg:px-12 lg:pb-[clamp(200px,16.5vw,300px)] lg:pt-20 xl:px-20">
        <div className="flex flex-col gap-8 lg:flex-row lg:justify-between">
          <div className="flex flex-col gap-3.5 lg:max-w-[300px] lg:gap-[18px] xl:max-w-[380px]">
            <p className="flex items-center gap-2.5 lg:gap-3">
              <span className="relative grid size-9 place-items-center overflow-hidden rounded-[10px] bg-accent text-brand lg:size-[42px] lg:rounded-xl">
                <VolcanoMark className="absolute left-1/2 top-1/2 w-12 -translate-x-1/2 -translate-y-1/2 lg:w-14" />
              </span>
              <span className="font-display text-[20px] font-bold lg:text-[22px]">Plaza Volcanes</span>
            </p>
            <p className="text-[15px] leading-[1.55] text-white/75 lg:text-[16px]">
              Un punto de encuentro para tiendas independientes y personas curiosas.
            </p>
          </div>

          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-12 text-[15px] lg:flex lg:gap-12 xl:gap-24">
            <nav aria-label="Navegación" className="flex flex-col gap-1">
              {/* As tall as the legal shelf's 44px summary beside it on a phone. */}
              <p className={`${LABEL} flex min-h-11 items-center lg:mb-1 lg:min-h-0`}>Plaza</p>
              <Link className={LINK} href="/">Explorar</Link>
              <Link className={LINK} href="/vender?desde=footer">Vender</Link>
              <Link className={LINK} href="/ingresar">Ingresar</Link>
            </nav>
            {/*
              Eight legal links at 44px apiece stand taller than the content of a
              short page on a phone, so they fold away there. `disclosure-mobile`
              reopens the panel from `lg` up, where the height costs nothing.
            */}
            <details aria-label="Información legal" className="disclosure-mobile" name="footer-shelf">
              <summary
                className={`tap flex cursor-pointer list-none items-center gap-2 lg:mb-1 lg:min-h-0 lg:cursor-default [&::-webkit-details-marker]:hidden ${LABEL}`}
              >
                Información legal
                <ChevronDown aria-hidden="true" className="size-4 transition-transform lg:hidden [details[open]_&]:rotate-180" />
              </summary>
              <nav aria-label="Información legal" className="grid gap-x-10 gap-y-1 lg:grid-flow-col lg:grid-rows-4 xl:gap-x-16">
                {LEGAL_ROUTES.map((route) => (
                  <Link className={LINK} href={route.path} key={route.path}>
                    {route.navLabel}
                  </Link>
                ))}
              </nav>
            </details>
          </div>
        </div>

        <div className="flex justify-between gap-4 border-t border-white/14 pt-[18px] text-[13px] text-white/65 lg:pt-[22px] lg:text-[14px]">
          <p>© 2026 Plaza Volcanes</p>
          <p>Hecho en México</p>
        </div>
      </div>

      <p
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[18px] left-3.5 select-none font-display text-[104px] font-extrabold leading-[0.9] tracking-[-0.05em] text-accent lg:-bottom-[0.14em] lg:left-[clamp(24px,4.2vw,60px)] lg:whitespace-nowrap lg:text-[clamp(160px,16.5vw,238px)] lg:leading-none"
      >
        Plaza <br className="lg:hidden" />
        <em className="italic">Volcanes</em>
      </p>
    </footer>
  );
}
