import { twMerge } from "tailwind-merge";

/** Local Tailwind utilities override defaults without depending on CSS order. */
export function cn(...classes: (string | false | null | undefined)[]) {
  return twMerge(classes.filter(Boolean).join(" "));
}
