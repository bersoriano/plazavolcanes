"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { HeaderMenu, type HeaderMenuLink } from "@/components/layout/header-menu";

type HeaderVariant = {
  sections: HeaderMenuLink[];
  /** The plum pill from sm up, and its short form on a phone (null: none). */
  cta: { href: string; label: string; short: string | null };
  /** Whether Ingresar stays in the header on a phone. */
  phoneSignIn: boolean;
};

/**
 * Every page but /vender: the home page's sections, rooted at "/" so they
 * lead home from anywhere, and a way in for would-be sellers.
 */
const DEFAULT_VARIANT: HeaderVariant = {
  sections: [
    { href: "/#explorar", label: "Explorar" },
    { href: "/#tiendas", label: "Tiendas" },
    { href: "/#pasos", label: "Cómo funciona" },
    { href: "/#vender", label: "Para vender" },
  ],
  cta: { href: "/vender?desde=header", label: "Abrir mi tienda", short: "Vender" },
  phoneSignIn: false,
};

/**
 * /vender: its own sections, and the pill goes straight to signup, since
 * the page it would lead to is the one already open. A phone keeps Ingresar
 * beside the menu instead of a pill that repeats the page's own CTA.
 */
const SELLER_VARIANT: HeaderVariant = {
  sections: [
    { href: "/explorar", label: "Explorar" },
    { href: "#fundadoras", label: "Tiendas fundadoras" },
    { href: "#pasos", label: "Cómo funciona" },
    { href: "#niveles", label: "Niveles" },
    { href: "#preguntas", label: "Preguntas" },
  ],
  cta: { href: "/registro?vender=1&desde=header", label: "Crear mi tienda", short: null },
  phoneSignIn: true,
};

/**
 * The signed-out half of the header, the only part that needs the route.
 * `usePathname` resolves during the server render too, so the right links are
 * in the HTML from the start.
 */
export function SignedOutHeaderNav() {
  const pathname = usePathname();
  const variant = pathname === "/vender" ? SELLER_VARIANT : DEFAULT_VARIANT;

  return (
    <>
      <nav aria-label="Secciones de la plaza" className="hidden items-center gap-1 xl:flex 2xl:gap-4">
        {variant.sections.map((link) => (
          <Link
            className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-3 text-[15px] font-semibold text-brand transition-colors hover:bg-background"
            href={link.href}
            key={link.href}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-1 sm:gap-3">
        <nav aria-label="Navegación principal" className="flex items-center gap-1 sm:gap-3">
          {/* Without phoneSignIn a phone reaches Ingresar from the quick access bar and the sheet. */}
          <Link
            aria-label="Ingresar"
            className={`min-h-11 items-center rounded-full px-3 text-[14px] font-semibold text-brand transition-colors hover:bg-background sm:inline-flex sm:px-4 sm:text-[15px] lg:px-5 ${
              variant.phoneSignIn ? "inline-flex" : "hidden"
            }`}
            href="/ingresar"
          >
            Ingresar
          </Link>
          {variant.cta.short ? (
            <Link
              className="inline-flex min-h-11 items-center rounded-full bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-hover sm:hidden"
              href={variant.cta.href}
            >
              {variant.cta.short}
            </Link>
          ) : null}
          <Link
            className="hidden h-12 items-center gap-2 rounded-full bg-brand px-6 text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover sm:inline-flex"
            href={variant.cta.href}
          >
            {variant.cta.label}
            <ArrowRight aria-hidden="true" className="size-[18px] text-accent" strokeWidth={2.2} />
          </Link>
        </nav>
        <HeaderMenu
          links={variant.phoneSignIn ? variant.sections : [...variant.sections, { href: "/ingresar", label: "Ingresar" }]}
        />
      </div>
    </>
  );
}
