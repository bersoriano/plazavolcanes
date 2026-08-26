"use client";

import { useState, type ReactNode } from "react";

type CatalogImageProps = {
  alt: string;
  className: string;
  fallback: ReactNode;
  src: string | null;
};

export function CatalogImage({ alt, className, fallback, src }: CatalogImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) return fallback;

  // Supabase project hostname is configured at deployment time.
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={alt} className={className} onError={() => setFailed(true)} src={src} />;
}
