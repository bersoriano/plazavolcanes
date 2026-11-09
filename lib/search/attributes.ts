/** One declared value per listing, shared by seller authoring and catalog filters. */
export const COLORS = ["black", "white", "blue", "red", "green"] as const;
export const SIZES = ["XS", "S", "M", "L", "XL"] as const;
export const MATERIALS = ["cotton", "wool", "leather", "polyester"] as const;

export const OTHER_FEATURES_MAX_LENGTH = 300;

export const COLOR_LABELS: Record<(typeof COLORS)[number], string> = {
  black: "Negro", white: "Blanco", blue: "Azul", red: "Rojo", green: "Verde",
};
export const MATERIAL_LABELS: Record<(typeof MATERIALS)[number], string> = {
  cotton: "Algodón", wool: "Lana", leather: "Cuero", polyester: "Poliéster",
};
