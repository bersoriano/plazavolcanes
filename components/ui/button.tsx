import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/components/ui/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent" | "unstyled";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--brand)] text-on-brand hover:bg-[var(--brand-hover)] shadow-[0_8px_24px_rgba(50,23,77,0.16)]",
  secondary:
    "border border-[var(--border)] bg-surface-raised text-[var(--brand)] hover:border-[var(--brand)]",
  ghost: "bg-transparent text-[var(--brand)] hover:bg-[var(--accent)]",
  danger: "bg-sale text-white hover:bg-sale/90",
  accent: "bg-accent text-brand-hover hover:bg-accent/80",
  unstyled: "",
};

type ActionStyleProps = {
  variant?: ButtonVariant;
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
};

const sizes = {
  default: "min-h-11 px-5 py-2.5 text-sm",
  sm: "min-h-11 px-3 py-2 text-xs",
  lg: "min-h-12 px-6 py-3 text-base",
  icon: "size-11 shrink-0 p-0",
};

export function buttonStyles({ variant = "primary", size = "default", className }: ActionStyleProps = {}) {
  return cn(
    "disabled:cursor-not-allowed disabled:opacity-55",
    variant !== "unstyled" && "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors",
    variant !== "unstyled" && sizes[size],
    variants[variant],
    className,
  );
}

export type ButtonProps = ComponentProps<"button"> & ActionStyleProps;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return (
    <button
      className={buttonStyles({ variant, size, className })}
      type={type}
      {...props}
    />
  );
}

export type ButtonLinkProps = ComponentProps<typeof Link> & ActionStyleProps;

/** Navigation remains an anchor, including prefetch and modified-click support. */
export function ButtonLink({ className, variant, size, ...props }: ButtonLinkProps) {
  return <Link className={buttonStyles({ variant, size, className })} {...props} />;
}
