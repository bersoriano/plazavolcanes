"use client";

import Link from "next/link";
import { useRef } from "react";
import { Menu, X } from "lucide-react";

export type HeaderMenuLink = { href: string; label: string };

/**
 * The signed-out header's sheet below xl, built on the Popover API: the
 * browser owns opening, light dismiss, Escape and the top layer. The only
 * script here closes the sheet when a link inside it is followed, because an
 * in-page anchor never leaves the page that would otherwise take it away.
 */
export function HeaderMenu({ links }: { links: HeaderMenuLink[] }) {
  const sheet = useRef<HTMLDivElement>(null);
  const close = () => sheet.current?.hidePopover();

  return (
    <>
      <button
        aria-label="Abrir menú"
        className="tap grid place-items-center rounded-full text-brand transition-colors hover:bg-background xl:hidden"
        popoverTarget="menu-principal"
        type="button"
      >
        <Menu aria-hidden="true" className="size-6" />
      </button>
      <div
        aria-label="Menú"
        className="fixed inset-x-0 top-0 bottom-auto m-0 h-auto w-full max-w-none border-b border-brand/12 bg-accent p-0 text-brand shadow-float backdrop:bg-brand/30"
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
        <nav aria-label="Secciones" className="flex flex-col px-4 pb-6 sm:px-8">
          {links.map((link) => (
            <Link
              className="flex min-h-14 items-center border-t border-brand/12 font-display text-[22px] font-semibold tracking-[-0.02em]"
              href={link.href}
              key={link.href}
              onClick={close}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
