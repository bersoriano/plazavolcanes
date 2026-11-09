import {
  AMOUNT_FORMAT, criteriaFields, intersectCriteria, invalid, isSearchTextWithinLimit,
  validateSearchCriteria, type CriteriaResult, type SearchCriteria,
} from "./criteria-schema";
import { interpretSearch } from "./interpret";

export { MAX_SEARCH_LENGTH, refineSearchCriteria, validateSearchCriteria, type CatalogSearchCriteria, type SearchCriteria } from "./criteria-schema";

const contextKeys = ["categoria", "subcategoria", "estado", "locale", "countryCode"];
const fieldKeys = criteriaFields.keyof().options.filter((field) => field !== "text");
const booleanFields = new Set<string>(["minInclusive", "maxInclusive", "inStock", "waterproof"]);

export function readSearchCriteria(params: Record<string, string | string[] | undefined>): CriteriaResult {
  const values: Record<string, string> = {};
  for (const key of ["q", "texto", ...fieldKeys, ...contextKeys]) {
    const value = params[key];
    if (Array.isArray(value) && value.some((v) => v !== value[0])) {
      return invalid("El enlace contiene valores distintos para un mismo filtro.");
    }
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) values[key] = first;
  }
  const original = values.q;
  const finish = (result: CriteriaResult) => original === undefined ? result : { ...result, original };
  if (original !== undefined && values.texto !== undefined) {
    return finish(invalid("Usa una sola forma de texto para la búsqueda."));
  }
  if (values.texto && !isSearchTextWithinLimit(values.texto)) {
    return invalid("La búsqueda debe tener un máximo de 500 caracteres.");
  }
  const fields: Record<string, unknown> = {};
  if (values.texto?.trim()) fields.text = values.texto.trim();
  for (const key of fieldKeys) {
    const value = values[key];
    if (value === undefined) continue;
    if (key === "min" || key === "max") {
      if (!AMOUNT_FORMAT.test(value)) return finish(invalid("Escribe un precio válido en MXN con un máximo de dos decimales."));
      fields[key] = Number(value);
    } else if (booleanFields.has(key)) {
      if (value !== "true" && value !== "false") return finish(invalid("El enlace contiene un filtro que no es válido."));
      fields[key] = value === "true";
    } else {
      fields[key] = value;
    }
  }
  const explicit = validateSearchCriteria(fields);
  if (explicit.error || original === undefined) return finish(explicit);
  // Legacy invalid market parameters reset to MX, just as the catalog route does.
  const country = values.countryCode?.trim().toUpperCase() ?? "MX";
  const interpreted = interpretSearch(original, /^[A-Z]{2}$/.test(country) ? country : "MX");
  return finish(interpreted.error ? interpreted : intersectCriteria(explicit.criteria, interpreted.criteria));
}

export function writeSearchCriteria(criteria: SearchCriteria): URLSearchParams {
  const params = new URLSearchParams();
  if (criteria.text) params.set("texto", criteria.text);
  for (const field of fieldKeys) {
    const value = criteria[field];
    if (value !== undefined) params.set(field, String(value));
  }
  return params;
}
