"use client";

import { usePathname } from "next/navigation";

import { pageContainer } from "@/components/layout/container";

/** Laid out on the landing's 1280px grid, which takes 80px gutters from xl. */
const LANDING_PATHS = new Set(["/", "/vender"]);

/**
 * The header's and footer's content box, matched to the page between them:
 * the app screens' container everywhere, widened to the landing's gutters on
 * the landing pages. `usePathname` resolves during the server render too, so
 * the right edges are in the HTML from the start.
 */
export function SiteFrame({ children, className }: { children: React.ReactNode; className: string }) {
  const landing = LANDING_PATHS.has(usePathname() ?? "");

  return <div className={`${pageContainer} ${landing ? "xl:px-20" : ""} ${className}`}>{children}</div>;
}
