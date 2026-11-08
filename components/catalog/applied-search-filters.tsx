import Link from "next/link";
import { X } from "lucide-react";

import { buildCatalogHref } from "@/lib/categories";
import { formatProductCondition } from "@/lib/product-condition";
import type { CatalogFilters } from "@/lib/queries/catalog";
import { COLOR_LABELS, MATERIAL_LABELS } from "@/lib/search/attributes";
import { refineSearchCriteria, type SearchCriteria } from "@/lib/search/criteria";

export function AppliedSearchFilters({ filters }: { filters: CatalogFilters }) {
  const criteria = filters.criteria;
  if (!criteria) return null;
  const chips: { label: string; remove: (keyof SearchCriteria)[] }[] = [];
  const { min, max, minInclusive, maxInclusive, condition, grade, color, size, material, waterproof } = criteria;
  if (min !== undefined) chips.push({
    label: `${minInclusive === false ? "Más de" : "Desde"} ${min} MXN`,
    remove: ["min"],
  });
  if (max !== undefined) chips.push({
    label: `${maxInclusive === false ? "Menos de" : "Hasta"} ${max} MXN`,
    remove: ["max"],
  });
  if (criteria.currency && min === undefined && max === undefined) chips.push({ label: "MXN", remove: ["currency"] });
  if (condition) chips.push({ label: formatProductCondition(condition, grade ?? null), remove: ["condition", "grade"] });
  if (criteria.inStock) chips.push({ label: "En existencia", remove: ["inStock"] });
  if (color) chips.push({ label: COLOR_LABELS[color], remove: ["color"] });
  if (size) chips.push({ label: `Talla ${size}`, remove: ["size"] });
  if (material) chips.push({ label: MATERIAL_LABELS[material], remove: ["material"] });
  if (waterproof !== undefined) chips.push({ label: waterproof ? "Impermeable" : "No impermeable", remove: ["waterproof"] });

  if (!chips.length) return null;
  return (
    <nav aria-label="Filtros aplicados" className="mb-6 flex flex-wrap gap-2">
      {chips.map(({ label, remove }) => {
        const next = refineSearchCriteria(criteria, { clear: remove });
        if (next.error) return null;
        return (
          <Link
            key={label}
            href={buildCatalogHref({ ...filters, criteria: next.criteria, stateSlug: filters.administrativeAreaSlug })}
            aria-label={`Quitar filtro: ${label}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-brand"
          >
            {label}<X className="size-4" aria-hidden="true" />
          </Link>
        );
      })}
    </nav>
  );
}
