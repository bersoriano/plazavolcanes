export const SUPPORTED_COUNTRY = {
  code: "MX",
  label: "México",
} as const;

export const MEXICO_ADMINISTRATIVE_AREAS = [
  { code: "MX-AGU", slug: "aguascalientes", label: "Aguascalientes" },
  { code: "MX-BCN", slug: "baja-california", label: "Baja California" },
  { code: "MX-BCS", slug: "baja-california-sur", label: "Baja California Sur" },
  { code: "MX-CAM", slug: "campeche", label: "Campeche" },
  { code: "MX-CHP", slug: "chiapas", label: "Chiapas" },
  { code: "MX-CHH", slug: "chihuahua", label: "Chihuahua" },
  { code: "MX-CMX", slug: "ciudad-de-mexico", label: "Ciudad de México" },
  { code: "MX-COA", slug: "coahuila", label: "Coahuila" },
  { code: "MX-COL", slug: "colima", label: "Colima" },
  { code: "MX-DUR", slug: "durango", label: "Durango" },
  { code: "MX-GUA", slug: "guanajuato", label: "Guanajuato" },
  { code: "MX-GRO", slug: "guerrero", label: "Guerrero" },
  { code: "MX-HID", slug: "hidalgo", label: "Hidalgo" },
  { code: "MX-JAL", slug: "jalisco", label: "Jalisco" },
  { code: "MX-MEX", slug: "estado-de-mexico", label: "Estado de México" },
  { code: "MX-MIC", slug: "michoacan", label: "Michoacán" },
  { code: "MX-MOR", slug: "morelos", label: "Morelos" },
  { code: "MX-NAY", slug: "nayarit", label: "Nayarit" },
  { code: "MX-NLE", slug: "nuevo-leon", label: "Nuevo León" },
  { code: "MX-OAX", slug: "oaxaca", label: "Oaxaca" },
  { code: "MX-PUE", slug: "puebla", label: "Puebla" },
  { code: "MX-QUE", slug: "queretaro", label: "Querétaro" },
  { code: "MX-ROO", slug: "quintana-roo", label: "Quintana Roo" },
  { code: "MX-SLP", slug: "san-luis-potosi", label: "San Luis Potosí" },
  { code: "MX-SIN", slug: "sinaloa", label: "Sinaloa" },
  { code: "MX-SON", slug: "sonora", label: "Sonora" },
  { code: "MX-TAB", slug: "tabasco", label: "Tabasco" },
  { code: "MX-TAM", slug: "tamaulipas", label: "Tamaulipas" },
  { code: "MX-TLA", slug: "tlaxcala", label: "Tlaxcala" },
  { code: "MX-VER", slug: "veracruz", label: "Veracruz" },
  { code: "MX-YUC", slug: "yucatan", label: "Yucatán" },
  { code: "MX-ZAC", slug: "zacatecas", label: "Zacatecas" },
] as const;

export const MEXICO_ADMINISTRATIVE_AREA_CODES = MEXICO_ADMINISTRATIVE_AREAS.map(
  ({ code }) => code,
) as [
  (typeof MEXICO_ADMINISTRATIVE_AREAS)[number]["code"],
  ...(typeof MEXICO_ADMINISTRATIVE_AREAS)[number]["code"][],
];

export const MAX_ADMINISTRATIVE_AREAS = 2;

export type AdministrativeArea = (typeof MEXICO_ADMINISTRATIVE_AREAS)[number];

export function findAdministrativeAreaBySlug(slug: string | undefined) {
  if (!slug) return undefined;
  return MEXICO_ADMINISTRATIVE_AREAS.find((area) => area.slug === slug);
}

export function findAdministrativeAreaByCode(code: string | null | undefined) {
  if (!code) return undefined;
  return MEXICO_ADMINISTRATIVE_AREAS.find((area) => area.code === code);
}

export function formatShopLocation(
  countryCode: string,
  administrativeAreaCodes: readonly string[] | null,
) {
  const countryLabel = countryCode === SUPPORTED_COUNTRY.code
    ? SUPPORTED_COUNTRY.label
    : countryCode;
  const areaLabels = (administrativeAreaCodes ?? [])
    .map((code) => MEXICO_ADMINISTRATIVE_AREAS.find((area) => area.code === code)?.label)
    .filter((label) => label !== undefined);

  if (!areaLabels.length) return countryLabel;

  return `${areaLabels.join(" y ")}, ${countryLabel}`;
}
