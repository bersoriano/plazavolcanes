"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, X } from "lucide-react";

/**
 * The first image is the cover, and the strip below it picks which one the big
 * frame shows. The big frame opens the same picture full screen, because the
 * detail a buyer is looking for — a glaze, a seam, a scratch on a used piece —
 * is rarely visible at the size the page can spare.
 */
export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const zoomRef = useRef<HTMLButtonElement>(null);
  const opened = useRef(false);
  const count = images.length;

  const step = useCallback(
    (offset: number) => setActive((current) => (current + offset + count) % count),
    [count],
  );

  // The overlay covers the page, so the keys belong to the window rather than to
  // whichever element inside it happens to hold focus.
  useEffect(() => {
    if (!zoomed) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setZoomed(false);
      else if (event.key === "ArrowRight") step(1);
      else if (event.key === "ArrowLeft") step(-1);
      else return;
      event.preventDefault();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [step, zoomed]);

  // Focus follows the overlay in and back out, so closing it never drops a
  // keyboard reader at the top of the document. The first pass is the page
  // loading, and a page that grabs focus on load is a page that scrolls itself.
  useEffect(() => {
    if (zoomed) {
      opened.current = true;
      closeRef.current?.focus();
    } else if (opened.current) {
      zoomRef.current?.focus({ preventScroll: true });
    }
  }, [zoomed]);

  // The overlay is fixed over the whole page, so the page behind it must not
  // scroll away under the picture.
  useEffect(() => {
    if (!zoomed) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [zoomed]);

  if (!count) {
    return (
      <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-[#eee8e1]">
        <div className="grid size-full place-items-center text-brand/30" data-testid="gallery-placeholder">
          <ImageIcon aria-hidden="true" className="size-16" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        aria-label="Ampliar imagen"
        className="relative block aspect-[4/3] w-full cursor-zoom-in overflow-hidden rounded-[2rem] bg-[#eee8e1] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        onClick={() => setZoomed(true)}
        ref={zoomRef}
        type="button"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={name}
          className="size-full object-cover"
          data-testid="gallery-active"
          src={images[active]}
        />
      </button>

      {count > 1 ? (
        <ul className="flex gap-3 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <li className="shrink-0" key={image}>
              <button
                aria-current={index === active ? "true" : undefined}
                aria-label={`Ver imagen ${index + 1}`}
                className={`block size-20 overflow-hidden rounded-xl border-2 bg-[#eee8e1] transition-colors sm:size-24 ${
                  index === active ? "border-brand" : "border-transparent hover:border-line"
                }`}
                onClick={() => setActive(index)}
                type="button"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={`${name}, imagen ${index + 1}`}
                  className="size-full object-cover"
                  src={image}
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {zoomed ? (
        <div
          aria-label={name}
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setZoomed(false);
          }}
          role="dialog"
        >
          <button
            aria-label="Cerrar"
            className="absolute right-4 top-4 inline-flex size-11 items-center justify-center rounded-full bg-surface/90 text-brand transition-colors hover:bg-surface"
            onClick={() => setZoomed(false)}
            ref={closeRef}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>

          {count > 1 ? (
            <button
              aria-label="Anterior"
              className="absolute left-2 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 text-brand transition-colors hover:bg-surface sm:left-4"
              onClick={() => step(-1)}
              type="button"
            >
              <ChevronLeft aria-hidden="true" className="size-5" />
            </button>
          ) : null}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={`${name}, imagen ${active + 1}`}
            className="max-h-full max-w-full object-contain"
            data-testid="lightbox-image"
            src={images[active]}
          />

          {count > 1 ? (
            <>
              <button
                aria-label="Siguiente"
                className="absolute right-2 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 text-brand transition-colors hover:bg-surface sm:right-4"
                onClick={() => step(1)}
                type="button"
              >
                <ChevronRight aria-hidden="true" className="size-5" />
              </button>
              <p className="absolute inset-x-0 bottom-5 text-center text-sm font-semibold text-white/80">
                {`${active + 1} / ${count}`}
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
