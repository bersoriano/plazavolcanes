import type { ComponentProps } from "react";

import { cn } from "@/components/ui/cn";

type ControlStyleProps = { variant?: "default" | "unstyled" };

const controlBase = "min-h-12 w-full min-w-0 rounded-2xl border border-line bg-surface px-4 text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none aria-invalid:border-sale";
const disabled = "disabled:cursor-not-allowed disabled:opacity-55";

export function Input({ className, variant = "default", ...props }: ComponentProps<"input"> & ControlStyleProps) {
  return <input className={cn(variant === "default" && controlBase, disabled, className)} {...props} />;
}

export function Select({ className, variant = "default", ...props }: ComponentProps<"select"> & ControlStyleProps) {
  return <select className={cn(variant === "default" && controlBase, disabled, className)} {...props} />;
}

export function Textarea({ className, variant = "default", ...props }: ComponentProps<"textarea"> & ControlStyleProps) {
  return <textarea className={cn(variant === "default" && controlBase, variant === "default" && "min-h-28 resize-y py-3", disabled, className)} {...props} />;
}
