"use client";

import { useRef } from "react";
import { ArrowRight, Menu, X } from "lucide-react";

import { NavLink } from "@/components/layout/nav-link";

export type HeaderMenuLink = { href: string; label: string };

/**
 * The signed-out header's sheet below lg, built on the Popover API: the
 * browser owns opening, light dismiss, Escape and the top layer. The only
 * script here closes the sheet when a link inside it is followed, because a
 * client-side navigation keeps the page, and the open sheet, in place.
 */
export function HeaderMenu({ cta, links }: { cta: HeaderMenuLink; links: HeaderMenuLink[] }) {
  const sheet = useRef<HTMLDivElement>(null);
  const close = () => sheet.current?.hidePopover();

  return (
    <>
      <button
        aria-label="Abrir menú"
        className="tap grid place-items-center rounded-full text-brand transition-colors hover:bg-background lg:hidden"
        popoverTarget="menu-principal"
        type="button"
      >
        <Menu aria-hidden="true" className="size-6" />
      </button>
      <div
        aria-label="Menú"
        className="fixed inset-x-0 top-0 bottom-auto m-0 h-auto w-full max-w-none border-b border-brand/10 bg-accent p-0 text-brand shadow-float backdrop:bg-brand/30"
        id="menu-principal"
        popover="auto"
        ref={sheet}
        role="dialog"
      >
        <div className="flex h-16 items-center justify-between px-4 sm:px-8">
          <span className="font-display text-[19px] font-bold tracking-[-0.02em]">Plaza Volcanes</span>
          <button
            aria-label="Cerrar menú"
            className="tap grid place-items-center rounded-full hover:bg-background"
            popoverTarget="menu-principal"
            popoverTargetAction="hide"
            type="button"
          >
            <X aria-hidden="true" className="size-6" />
          </button>
        </div>
        <nav aria-label="Menú principal" className="flex flex-col px-4 pb-6 sm:px-8">
          {links.map((link) => (
            <NavLink
              className="flex min-h-14 items-center border-t border-brand/10 font-display text-[22px] font-semibold tracking-[-0.02em] decoration-2 underline-offset-8 aria-[current=page]:underline"
              href={link.href}
              key={link.href}
              onClick={close}
            >
              {link.label}
            </NavLink>
          ))}
          <NavLink
            className="mt-4 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-6 text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover"
            href={cta.href}
            onClick={close}
          >
            {cta.label}
            <ArrowRight aria-hidden="true" className="size-[18px] text-accent" strokeWidth={2.2} />
          </NavLink>
        </nav>
      </div>
    </>
  );
}
