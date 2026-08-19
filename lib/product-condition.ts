export type ProductCondition = "new" | "used";
export type UsedCondition = "mint" | "good" | "fair" | "bad" | "scrap";

export const USED_CONDITION_OPTIONS: ReadonlyArray<{
  value: UsedCondition;
  label: string;
}> = [
  { value: "mint", label: "Como nuevo" },
  { value: "good", label: "Buen estado" },
  { value: "fair", label: "Aceptable" },
  { value: "bad", label: "Mal estado" },
  { value: "scrap", label: "Para piezas" },
];

export function formatProductCondition(
  condition: ProductCondition,
  usedCondition: UsedCondition | null,
) {
  if (condition === "new") return "Nuevo";
  const detail = USED_CONDITION_OPTIONS.find(
    (option) => option.value === usedCondition,
  )?.label;
  return detail ? `Usado · ${detail}` : "Usado";
}
