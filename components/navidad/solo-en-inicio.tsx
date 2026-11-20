"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { Adorno } from "@/components/navidad/adornos";
import { NAVIDAD_ACTIVA } from "@/lib/navidad";

/**
 * The header, the footer and the launch bar are on every page, but the
 * Christmas layer belongs to the landing, and its stylesheet only loads
 * there (app/page.tsx). `usePathname` resolves during the server render
 * too, so the overlays are in the landing's HTML from the start and nowhere
 * else.
 */
function enInicio(pathname: string | null) {
  return NAVIDAD_ACTIVA && pathname === "/";
}

export function SoloEnInicio({ children }: { children: ReactNode }) {
  return enInicio(usePathname()) ? children : null;
}

/**
 * The hat on the header's logo mark. The mark clips its own volcano
 * (overflow-hidden), so the hat cannot live inside it: a plain span takes
 * the mark and the hat together. As a flex item it is blockified and wraps
 * the mark's box exactly, so nothing moves.
 */
export function ConGorro({ children }: { children: ReactNode }) {
  if (!enInicio(usePathname())) return children;

  return (
    <span className="nv-anclaje">
      {children}
      <Adorno as="span" className="nv--gorro" src="gorro.svg" />
    </span>
  );
}
