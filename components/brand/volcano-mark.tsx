import type { SVGProps } from "react";

type VolcanoMarkProps = Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & {
  /**
   * The ridge's stroke, in the 640×170 viewBox's own units. The default reads
   * as a logo at badge size; a mark stretched across a hero is scaled up by the
   * same factor and turns into a slab, so those callers pass 3–6 instead.
   */
  strokeWidth?: number;
};

export function VolcanoMark({ strokeWidth = 13, ...props }: VolcanoMarkProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 640 170" {...props}>
      <path d="M8 152c76-2 107-16 148-46 34-25 56-35 83-14 17 14 27 10 44-9l57-65 70 78c16 18 29 17 47 3 24-19 42-14 73 12 32 27 60 38 102 40" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
      <path d="m303 61 37-43 38 43-20-8-18 14-17-13-20 7Z" fill="currentColor" />
    </svg>
  );
}
