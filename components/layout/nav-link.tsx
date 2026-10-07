"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

/**
 * Whether `href` is the destination the reader is already at. `/` would
 * otherwise prefix every route, so the home entry only matches itself.
 *
 * Compared on the path alone: an entry may carry a query string to say where
 * the visit came from, and `usePathname` never returns one, so matching the
 * whole href would quietly stop marking that entry as current.
 */
export function isCurrent(pathname: string, href: string) {
  const path = href.split(/[?#]/)[0];
  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
}

/**
 * A navigation link that says when it is the current page. Styling keys off
 * `aria-current`, so a server-rendered header can hand its classes straight
 * through; `usePathname` resolves during the server render too, so the mark
 * is in the HTML from the start.
 */
export function NavLink({ href, ...props }: ComponentProps<typeof Link> & { href: string }) {
  const pathname = usePathname() ?? "";

  return <Link aria-current={isCurrent(pathname, href) ? "page" : undefined} href={href} {...props} />;
}
