import { Select, Textarea } from "@/components/ui/input";
import type { ActionState } from "@/lib/action-state";
import type { Product } from "@/lib/database.types";
import { COLORS, COLOR_LABELS, MATERIALS, MATERIAL_LABELS, OTHER_FEATURES_MAX_LENGTH, SIZES } from "@/lib/search/attributes";

export type ListingAttributes = Partial<Pick<Product, "color" | "size" | "material" | "waterproof" | "other_features" | "phone_battery_health" | "phone_carrier_status" | "phone_repair_history">>;

const fields = [
  { name: "color", label: "Color", options: COLORS.map((value) => ({ value, label: COLOR_LABELS[value] })) },
  { name: "size", label: "Talla", options: SIZES.map((value) => ({ value, label: value })) },
  { name: "material", label: "Material", options: MATERIALS.map((value) => ({ value, label: MATERIAL_LABELS[value] })) },
  { name: "waterproof", label: "Impermeable", options: [{ value: "true", label: "Sí" }, { value: "false", label: "No" }] },
] as const;

export function ProductAttributeFields({ product, state }: { product?: ListingAttributes; state: ActionState }) {
  const error = state.errors?.other_features?.[0];
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-ink">Características opcionales</legend>
      <p className="text-sm text-muted">Indica las características de esta presentación del producto.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(({ name, label, options }) => {
          const stored = String(product?.[name] ?? "");
          const error = state.errors?.[name]?.[0];
          return (
            <div className="space-y-2" key={name}>
              <label className="block text-sm font-semibold text-ink" htmlFor={name}>{label}</label>
              <Select
                aria-describedby={error ? `${name}-error` : undefined}
                aria-invalid={Boolean(error)}
                data-draft-baseline={stored}
                defaultValue={state.values?.[name] ?? stored}
                id={name}
                name={name}
              >
                <option value="">Sin especificar</option>
                {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
              {error ? <p className="text-sm font-medium text-sale" id={`${name}-error`}>{error}</p> : null}
            </div>
          );
        })}
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-ink" htmlFor="other_features">Otras características</label>
        <Textarea
          id="other_features"
          name="other_features"
          maxLength={OTHER_FEATURES_MAX_LENGTH}
          placeholder="Ej. Capucha desmontable, forro térmico o bolsillos interiores."
          data-draft-baseline={product?.other_features ?? ""}
          defaultValue={state.values?.other_features ?? product?.other_features ?? ""}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "other_features-error" : undefined}
        />
        {error ? <p className="text-sm font-medium text-sale" id="other_features-error">{error}</p> : null}
      </div>
    </fieldset>
  );
}
