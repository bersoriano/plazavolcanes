import { ArrowRight } from "lucide-react";

import { HeaderMenu, type HeaderMenuLink } from "@/components/layout/header-menu";
import { NavLink } from "@/components/layout/nav-link";

/**
 * The plaza's destinations, the same on every page so the header never
 * rearranges itself under the reader. Pages with sections of their own (the
 * landing, /vender) keep those in the page, not here.
 */
const DESTINATIONS: HeaderMenuLink[] = [
  { href: "/explorar", label: "Explorar" },
  { href: "/como-comprar", label: "Cómo comprar" },
  { href: "/vender?desde=header", label: "Vender" },
];

/**
 * Says what it does: signup, already marked as a seller. "Vender" beside it is
 * the way for somebody who wants to read the offer first.
 */
const CREATE_STORE: HeaderMenuLink = { href: "/registro?vender=1&desde=header", label: "Crear mi tienda" };

const SIGN_IN: HeaderMenuLink = { href: "/ingresar", label: "Ingresar" };

/**
 * The signed-out half of the header: the destinations inline from lg, then
 * Ingresar and the pill from sm, and below lg a sheet with all of it. A phone
 * shows only the menu button: the quick access bar holds Explorar, Vender and
 * Ingresar there.
 */
export function SignedOutHeaderNav() {
  return (
    <>
      <nav aria-label="Navegación principal" className="hidden items-center gap-1 lg:flex xl:gap-3">
        {DESTINATIONS.map((link) => (
          <NavLink
            className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-3 text-[15px] font-semibold text-brand transition-colors hover:bg-background aria-[current=page]:bg-background"
            href={link.href}
            key={link.href}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-1 sm:gap-3">
        <NavLink
          aria-label={SIGN_IN.label}
          className="hidden min-h-11 items-center rounded-full px-4 text-[15px] font-semibold text-brand transition-colors hover:bg-background sm:inline-flex lg:px-5"
          href={SIGN_IN.href}
        >
          {SIGN_IN.label}
        </NavLink>
        <NavLink
          className="hidden h-12 items-center gap-2 rounded-full bg-brand px-6 text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover sm:inline-flex"
          href={CREATE_STORE.href}
        >
          {CREATE_STORE.label}
          <ArrowRight aria-hidden="true" className="size-[18px] text-accent" strokeWidth={2.2} />
        </NavLink>
        <HeaderMenu cta={CREATE_STORE} links={[...DESTINATIONS, SIGN_IN]} />
      </div>
    </>
  );
}
