import type { ComponentProps } from "react";

import { cn } from "@/components/ui/cn";

type BadgeProps = ComponentProps<"span"> & {
  variant?: "accent" | "neutral" | "danger" | "success" | "brand" | "unstyled";
};

const variants = {
  accent: "bg-accent text-brand-hover",
  neutral: "bg-background text-muted",
  danger: "bg-sale/15 text-sale",
  success: "bg-success/10 text-success",
  brand: "bg-brand text-on-brand",
  unstyled: "",
};

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return <span className={cn(variant !== "unstyled" && "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold", variants[variant], className)} {...props} />;
}
