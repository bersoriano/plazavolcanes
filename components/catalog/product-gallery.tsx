import { ImageIcon } from "lucide-react";

/** The first image is the cover; the rest follow it as a thumbnail strip. */
export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [cover, ...rest] = images;

  if (!cover) {
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
      <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-[#eee8e1]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={name} className="size-full object-cover" src={cover} />
      </div>
      {rest.length ? (
        <ul className="flex gap-3 overflow-x-auto pb-1">
          {rest.map((image, index) => (
            <li className="shrink-0" key={image}>
              <span className="block size-20 overflow-hidden rounded-xl bg-[#eee8e1] sm:size-24">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={`${name}, imagen ${index + 2}`}
                  className="size-full object-cover"
                  src={image}
                />
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
