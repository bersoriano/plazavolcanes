import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

/**
 * The landing's shared pieces. Type sizes interpolate between the handoff's
 * 390px and 1440px scales with clamp(), so 768 and 1024 land in between
 * instead of jumping at a breakpoint.
 */
export const TYPE = {
  /** 52/0.96 → 100/0.94 */
  h1: "font-display text-[clamp(52px,34.2px+4.571vw,100px)] font-semibold leading-[0.95] tracking-[-0.042em]",
  /** 46/1 → 76/0.98 */
  h2: "font-display text-[clamp(46px,34.9px+2.857vw,76px)] font-semibold leading-[0.99] tracking-[-0.04em]",
  /** 24 → 30 */
  h3: "font-display text-[clamp(22px,19.8px+0.571vw,30px)] font-semibold leading-[1.05] tracking-[-0.027em]",
  /** 16 → 18, for the text beside a section heading. */
  aside: "text-[clamp(16px,15.3px+0.19vw,18px)] leading-[1.55] text-text-body",
} as const;

/** The worked example the hero's receipt and the 0% block both show. */
export const EXAMPLE_PRICE = "$1,999.00";

/** The section eyebrow: small, bold, spaced capitals in plum. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-[12px] font-bold uppercase tracking-[0.14em] text-brand lg:text-[13px] ${className}`}>
      {children}
    </p>
  );
}

/** The italic plum accent words every heading ends on. */
export function Accent({ children, className = "text-brand" }: { children: ReactNode; className?: string }) {
  return <em className={`italic ${className}`}>{children}</em>;
}

/**
 * The handoff's two-ridge motif (assets/volcano-line.svg), drawn in
 * currentColor so each section tints it with a text colour class.
 */
export function VolcanoLines({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      preserveAspectRatio="none"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 1440 260"
    >
      <path d="M0 250 L260 70 L360 150 L470 40 L760 250" vectorEffect="non-scaling-stroke" />
      <path d="M620 250 L900 90 L990 150 L1080 60 L1440 250" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * The landing's main call to action: a plum pill that ends in a lime circle
 * holding the arrow. `block` stretches it across a phone's column.
 */
export function PrimaryCta({
  href,
  children,
  block = false,
  className = "",
}: {
  href: string;
  children: ReactNode;
  block?: boolean;
  className?: string;
}) {
  return (
    <Link
      className={`inline-flex h-[58px] items-center gap-4 rounded-full bg-brand pl-6 pr-2 text-[17px] font-semibold text-white shadow-cta transition-colors hover:bg-brand-hover lg:h-[62px] lg:pl-[30px] lg:pr-2.5 lg:text-[18px] ${
        block ? "justify-between sm:justify-start" : ""
      } ${className}`}
      href={href}
    >
      {children}
      <span aria-hidden="true" className="grid size-[42px] shrink-0 place-items-center rounded-full bg-accent text-brand lg:size-11">
        <ArrowRight className="size-5" strokeWidth={2.2} />
      </span>
    </Link>
  );
}
