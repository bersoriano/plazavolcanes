import type { HTMLAttributes } from "react";

import { cn } from "@/components/ui/cn";

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "article" | "aside";
  variant?: "default" | "muted" | "brand" | "unstyled";
  padding?: "none" | "sm" | "md" | "lg";
};

const variants = {
  default: "border border-line bg-surface",
  muted: "border border-line bg-background",
  brand: "bg-brand text-on-brand",
  unstyled: "",
};
const paddings = { none: "", sm: "p-5", md: "p-6", lg: "p-6 sm:p-8" };

export function Card({ as: Component = "div", className, variant = "default", padding = "none", ...props }: CardProps) {
  return <Component className={cn(variant !== "unstyled" && "rounded-[2rem]", variants[variant], paddings[padding], className)} {...props} />;
}
