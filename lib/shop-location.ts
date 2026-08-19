export const SUPPORTED_COUNTRY = {
  code: "MX",
  label: "México",
} as const;

export const MEXICO_ADMINISTRATIVE_AREAS = [
  { code: "MX-AGU", label: "Aguascalientes" },
  { code: "MX-BCN", label: "Baja California" },
  { code: "MX-BCS", label: "Baja California Sur" },
  { code: "MX-CAM", label: "Campeche" },
  { code: "MX-CHP", label: "Chiapas" },
  { code: "MX-CHH", label: "Chihuahua" },
  { code: "MX-CMX", label: "Ciudad de México" },
  { code: "MX-COA", label: "Coahuila" },
  { code: "MX-COL", label: "Colima" },
  { code: "MX-DUR", label: "Durango" },
  { code: "MX-GUA", label: "Guanajuato" },
  { code: "MX-GRO", label: "Guerrero" },
  { code: "MX-HID", label: "Hidalgo" },
  { code: "MX-JAL", label: "Jalisco" },
  { code: "MX-MEX", label: "Estado de México" },
  { code: "MX-MIC", label: "Michoacán" },
  { code: "MX-MOR", label: "Morelos" },
  { code: "MX-NAY", label: "Nayarit" },
  { code: "MX-NLE", label: "Nuevo León" },
  { code: "MX-OAX", label: "Oaxaca" },
  { code: "MX-PUE", label: "Puebla" },
  { code: "MX-QUE", label: "Querétaro" },
  { code: "MX-ROO", label: "Quintana Roo" },
  { code: "MX-SLP", label: "San Luis Potosí" },
  { code: "MX-SIN", label: "Sinaloa" },
  { code: "MX-SON", label: "Sonora" },
  { code: "MX-TAB", label: "Tabasco" },
  { code: "MX-TAM", label: "Tamaulipas" },
  { code: "MX-TLA", label: "Tlaxcala" },
  { code: "MX-VER", label: "Veracruz" },
  { code: "MX-YUC", label: "Yucatán" },
  { code: "MX-ZAC", label: "Zacatecas" },
] as const;

export const MEXICO_ADMINISTRATIVE_AREA_CODES = MEXICO_ADMINISTRATIVE_AREAS.map(
  ({ code }) => code,
) as [
  (typeof MEXICO_ADMINISTRATIVE_AREAS)[number]["code"],
  ...(typeof MEXICO_ADMINISTRATIVE_AREAS)[number]["code"][],
];

export function formatShopLocation(
  countryCode: string,
  administrativeAreaCode: string | null,
) {
  const countryLabel = countryCode === SUPPORTED_COUNTRY.code
    ? SUPPORTED_COUNTRY.label
    : countryCode;
  const areaLabel = MEXICO_ADMINISTRATIVE_AREAS.find(
    ({ code }) => code === administrativeAreaCode,
  )?.label;

  return areaLabel ? `${areaLabel}, ${countryLabel}` : countryLabel;
}
