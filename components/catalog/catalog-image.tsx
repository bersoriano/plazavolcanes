"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type CatalogImageProps = {
  alt: string;
  className: string;
  fallback: ReactNode;
  src: string | null;
};

export function CatalogImage({ alt, className, fallback, src }: CatalogImageProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageState, setImageState] = useState({ failed: false, src });

  if (imageState.src !== src) {
    setImageState({ failed: false, src });
  }

  const failed = imageState.src === src && imageState.failed;

  useEffect(() => {
    const image = imageRef.current;

    if (src && !failed && image?.complete && image.naturalWidth === 0) {
      setImageState({ failed: true, src });
    }
  }, [failed, src]);

  if (!src || failed) return fallback;

  return (
    // Supabase project hostname is configured at deployment time.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      className={className}
      onError={() => setImageState({ failed: true, src })}
      ref={imageRef}
      src={src}
    />
  );
}
