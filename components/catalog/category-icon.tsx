import {
  Baby,
  Bike,
  BookOpen,
  Car,
  House,
  Palette,
  PawPrint,
  Shirt,
  Smartphone,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

import type { CategoryIconName } from "@/lib/categories";

const CATEGORY_ICONS: Record<CategoryIconName, LucideIcon> = {
  electronics: Smartphone,
  home: House,
  fashion: Shirt,
  beauty: Sparkles,
  food: UtensilsCrossed,
  sports: Bike,
  kids: Baby,
  art: Palette,
  pets: PawPrint,
  automotive: Car,
  books: BookOpen,
};

export function CategoryIcon({ name, ...props }: LucideProps & { name: CategoryIconName }) {
  const Icon = CATEGORY_ICONS[name];
  return <Icon {...props} />;
}
