"use client";

import { useState } from "react";

import { findCategorySelection, type CategoryTree } from "@/lib/categories";

type CategoryFieldsProps = {
  categories: CategoryTree[];
  selectedLeafId?: number | null;
  error?: string;
};

export function CategoryFields({ categories, selectedLeafId, error }: CategoryFieldsProps) {
  const initialSelection = findCategorySelection(categories, selectedLeafId);
  const [parentId, setParentId] = useState<number | null>(initialSelection.parentId);
  const [leafId, setLeafId] = useState<number | null>(initialSelection.leafId);
  const selectedParent = categories.find((category) => category.id === parentId) ?? null;
  const selectedLeaf = selectedParent?.children.find((category) => category.id === leafId) ?? null;
  const hasInactiveSelection = Boolean(
    selectedLeaf && (!selectedLeaf.isActive || !selectedParent?.isActive),
  );
  const describedBy = [
    error ? "category-error" : null,
    hasInactiveSelection ? "category-inactive" : null,
  ].filter(Boolean).join(" ") || undefined;

  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold text-ink">Clasificación</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-ink" htmlFor="category-parent">Categoría</label>
          <select
            className="min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-ink focus:border-brand focus:outline-none"
            id="category-parent"
            onChange={(event) => {
              setParentId(event.currentTarget.value ? Number(event.currentTarget.value) : null);
              setLeafId(null);
            }}
            value={parentId ?? ""}
          >
            <option value="">Selecciona una categoría</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}{category.isActive ? "" : " (no disponible)"}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-ink" htmlFor="category-leaf">Subcategoría</label>
          <select
            aria-describedby={describedBy}
            aria-invalid={Boolean(error)}
            className="min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-ink focus:border-brand focus:outline-none disabled:cursor-not-allowed disabled:opacity-55"
            disabled={!selectedParent}
            id="category-leaf"
            name="category_id"
            onChange={(event) => setLeafId(event.currentTarget.value ? Number(event.currentTarget.value) : null)}
            value={leafId ?? ""}
          >
            <option value="">Selecciona una subcategoría</option>
            {selectedParent?.children.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}{category.isActive ? "" : " (no disponible)"}
              </option>
            ))}
          </select>
          {error ? <p className="text-sm font-medium text-sale" id="category-error">{error}</p> : null}
          {hasInactiveSelection ? (
            <p className="text-sm font-medium text-sale" id="category-inactive">
              Esta subcategoría ya no está disponible. Selecciona otra antes de publicar.
            </p>
          ) : null}
        </div>
      </div>
      <p className="text-xs leading-5 text-muted">Puedes guardar un borrador sin subcategoría.</p>
    </fieldset>
  );
}
