"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

type CatalogJumpLinkProps = Omit<ComponentProps<typeof Link>, "href" | "onNavigate">;

export function CatalogJumpLink(props: CatalogJumpLinkProps) {
  return (
    <Link
      {...props}
      href="#catalogo"
      onNavigate={() => document.getElementById("catalogo")?.focus()}
    />
  );
}
