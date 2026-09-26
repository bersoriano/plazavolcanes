"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";

/**
 * A catalogue photo through next/image, standing in for the tinted
 * placeholder the handoff draws. A missing or broken photo shows the
 * placeholder instead of an empty frame, as CatalogImage does elsewhere.
 */
export function LandingPhoto({
  src,
  alt = "",
  sizes,
  preload = false,
  fallback,
  className = "object-cover",
}: {
  src: string | null;
  alt?: string;
  sizes: string;
  preload?: boolean;
  fallback: ReactNode;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);

  if (!src || failed === src) return <>{fallback}</>;

  return (
    <Image
      alt={alt}
      className={className}
      fill
      onError={() => setFailed(src)}
      preload={preload}
      sizes={sizes}
      src={src}
    />
  );
}
