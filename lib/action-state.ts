export type ActionState = {
  status: "idle" | "error" | "success";
  message: string;
  errors?: Record<string, string[]>;
  /**
   * What the person had typed. React 19 resets a form once its action settles,
   * so a rejected submit must hand the values back for the fields to restore.
   */
  values?: Record<string, string>;
};

export const initialActionState: ActionState = {
  status: "idle",
  message: "",
};

/** Fields never worth echoing back: secrets, and files the browser cannot refill. */
const OMITTED_FIELDS = new Set(["password"]);

export function formValues(formData: FormData) {
  const values: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (OMITTED_FIELDS.has(key) || value instanceof File) continue;
    // Repeated fields keep every entry, indexed after the first.
    const name = key in values ? `${key}[${Object.keys(values).filter((k) => k === key || k.startsWith(`${key}[`)).length}]` : key;
    values[name] = value;
  }

  return values;
}
