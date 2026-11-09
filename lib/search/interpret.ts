import { SIZES } from "./attributes";
import {
  AMOUNT_FORMAT,
  intersectCriteria,
  invalid,
  isSearchTextWithinLimit,
  validateSearchCriteria,
  type CriteriaResult,
  type SearchCriteria,
} from "./criteria-schema";

type Token = { text: string; word: string; quoted: boolean };

function tokenize(input: string): Token[] {
  const chunks = input.match(/-?(?:"[^"]*"|“[^”]*”|«[^»]*»|'[^']*')|\S+/gu) ?? [];
  return chunks.map((chunk) => {
    const prefix = chunk.startsWith("-") ? "-" : "";
    const body = chunk.slice(prefix.length);
    const quoted = /^(?:"[^"]*"|“[^”]*”|«[^»]*»|'[^']*')$/u.test(body);
    const text = quoted ? prefix + '"' + body.slice(1, -1) + '"' : chunk;
    const word = quoted ? "" : text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    return { text, word, quoted };
  });
}

const bounds = [
  { phrase: /^(?:por )?(?:menos de|debajo de|under|below|less than) /, bound: "max", inclusive: false },
  { phrase: /^(?:por )?(?:hasta|como maximo|a lo sumo|no mas de|up to|at most|no more than) /, bound: "max", inclusive: true },
  { phrase: /^(?:por )?(?:mas de|encima de|over|above|more than) /, bound: "min", inclusive: false },
  { phrase: /^(?:desde|al menos|como minimo|no menos de|at least|no less than) /, bound: "min", inclusive: true },
] as const;
const budgetError = "Escribe un límite de precio en MXN, por ejemplo «menos de 100 pesos» o «hasta 100 MXN».";
const currencyError = "El catálogo admite precios en pesos mexicanos (MXN).";
// ISO codes apply only next to an amount. Codes such as PEN are also product words.
const currencyCodes = new Set(Intl.supportedValuesOf("currency"));
const namedCurrency = /^(?:dolares?|dollars?|euros?|libras?)$/;
const foreignCurrency = /^(?:us\$|[€£¥]|(?:usd|eur|cad|gbp|dolares?|dollars?|euros?|libras?)(?:$|[\d$]))/;
const possibleAmount = /^(?:[.,\d$+−–-]|mxn|mx\$|(?:un[ao]?|uno|dos|tres|cuatro|cinco|diez|veinte|cien|mil|one|two|three|four|five|ten|twenty|fifty|hundred|thousand)\b)/;

type Phrase = { count: number; criteria: SearchCriteria } | { error: string };

function readPrice(words: string, tokens: Token[], index: number, market: string): Phrase | undefined {
  for (const { phrase, bound, inclusive } of bounds) {
    const match = words.match(phrase);
    if (!match) continue;
    let end = index + match[0].trim().split(" ").length;
    let value = tokens[end]?.word ?? "";
    let explicitlyMxn = /mx\$|mxn|pesos?/.test(value);
    let currencyMarker = explicitlyMxn || value.includes("$");
    if (foreignCurrency.test(value)) return { error: currencyError };
    if (!possibleAmount.test(value)) continue;
    if (["$", "mxn", "mx$"].includes(value)) value = tokens[++end]?.word ?? "";
    const amount = value.match(/^(?:mx\$|\$)?(\d+(?:\.\d+)?)(?:mxn|pesos?)?$/)?.[1];
    if (!amount || !AMOUNT_FORMAT.test(amount)) return { error: budgetError };
    end++;
    if (/^(?:mxn|pesos?)$/.test(tokens[end]?.word ?? "")) {
      explicitlyMxn = true;
      currencyMarker = true;
      end++;
      if (/^mexicanos?$/.test(tokens[end]?.word ?? "")) end++;
    }
    const after = (tokens[end]?.word ?? "").replace(/[.,!?;:]$/, "");
    if (!explicitlyMxn && market !== "MX") {
      return { error: "Fuera de México, indica el presupuesto en MXN o pesos mexicanos." };
    }
    const qualifiedDollars = /^(?:american|canadian|australian|us|americanos?|canadienses?)$/.test(after)
      && namedCurrency.test(tokens[end + 1]?.word ?? "");
    const foreignPesos = /^(?:argentin[oa]s?|colombian[oa]s?|chilen[oa]s?|uruguay[oa]s?|cuban[oa]s?|filipin[oa]s?|dominican[oa]s?)$/.test(after);
    if (currencyCodes.has(after.toUpperCase()) || foreignCurrency.test(after) || qualifiedDollars || foreignPesos) {
      return { error: currencyError };
    }
    // Without a currency marker, a following noun may be a unit (e.g. "under 50 pages").
    if (!currencyMarker && after && !["and", "y", "or", "o"].includes(after) &&
        !readAttribute(tokens.slice(end, end + 4).map(({ word }) => word).join(" "))) {
      return { error: budgetError };
    }
    if (/^(?:to\b|a\b|hasta\b|[-–]|\d|kg\b|g\b|cm\b|mm\b|m\b|km\b|lbs?\b|inches\b|years?\b|anos?\b|mil\b|million\b|hundred\b|thousand\b)/.test(after)) {
      return { error: budgetError };
    }
    return { count: end - index, criteria: { [bound]: Number(amount), [bound + "Inclusive"]: inclusive } };
  }
}

const vocabulary: ReadonlyArray<[RegExp, SearchCriteria]> = [
  [/^(?:waterproof|impermeables?)\b/, { waterproof: true }],
  [/^(?:in stock|en (?:stock|existencia)|con existencias?)\b/, { inStock: true }],
  [/^(?:like new|mint condition|como nuev[oa])\b/, { grade: "mint" }],
  [/^(?:good condition|en buen estado)\b/, { grade: "good" }],
  [/^(?:fair condition|estado aceptable)\b/, { grade: "fair" }],
  [/^(?:poor condition|en mal estado)\b/, { grade: "bad" }],
  [/^(?:for parts|para piezas)\b/, { grade: "scrap" }],
  [/^(?:brand new|new|nuev[oa]s?)\b/, { condition: "new" }],
  [/^(?:second hand|de segunda mano|used|usad[oa]s?)\b/, { condition: "used" }],
  [/^(?:color )?(?:black|negr[oa]s?)\b/, { color: "black" }],
  [/^(?:color )?(?:white|blanc[oa]s?)\b/, { color: "white" }],
  [/^(?:color )?(?:blue|azul(?:es)?)\b/, { color: "blue" }],
  [/^(?:color )?(?:red|roj[oa]s?)\b/, { color: "red" }],
  [/^(?:color )?(?:green|verdes?)\b/, { color: "green" }],
  [/^(?:de )?(?:cotton|algodon)\b/, { material: "cotton" }],
  [/^(?:de )?(?:wool|lana)\b/, { material: "wool" }],
  [/^(?:de )?(?:leather|cuero|piel)\b/, { material: "leather" }],
  [/^(?:de )?(?:polyester|poliester)\b/, { material: "polyester" }],
];

function readAttribute(words: string, previous = ""): Phrase | undefined {
  // "Red" also means network or net in Spanish.
  if (/^red(?: |$)/.test(words) && (
    /^(?:de|la|una|en)$/.test(previous) ||
    /^red (?:de|inalambrica|local|movil|wifi|ethernet|lan)(?: |$)/.test(words)
  )) return;
  if (/^new (?:balance|york|era)(?: |$)/.test(words)) return;
  const requestedSize = words.match(/^(?:size|talla) (\S+)/)?.[1];
  if (requestedSize) {
    const size = SIZES.find((value) => value.toLowerCase() === requestedSize);
    if (size) return { count: 2, criteria: { size } };
  }
  for (const [pattern, criteria] of vocabulary) {
    const result = words.match(pattern);
    // A match must consume whole tokens, including every part of a hyphenated word.
    if (result && (words.length === result[0].length || words[result[0].length] === " ")) {
      return { count: result[0].split(" ").length, criteria };
    }
  }
  if (/^(?:talla|size|color|material) (?:\S+)/.test(words)) {
    return { error: "Elige una talla, un color o un material disponible en el catálogo." };
  }
}

function unsupportedBudget(words: string, token: string) {
  const [amount, units] = words.split(" ", 2);
  if (/^\d+(?:[.,]\d+)?$/.test(amount) && units && units !== "mxn" &&
      (currencyCodes.has(units.toUpperCase()) || namedCurrency.test(units))) return currencyError;
  if (foreignCurrency.test(token) && !namedCurrency.test(token)) return currencyError;
  if (/[\d$][€£¥$]|\$|^(?:mxn|pesos?)$|^\d+(?:usd|mxn|eur|pesos?)$/i.test(token) ||
      /^(?:between|entre|around|about|aproximadamente|cerca de) (?:\d|\$)/.test(words) ||
      /^(?:budget|presupuesto|price|precio)(?: |$).*(?:\d|\$)/.test(words) ||
      /^(?:[<>]=?)\s*\d/.test(words)) return budgetError;
}

export function interpretSearch(input: string, market: string): CriteriaResult {
  if (!isSearchTextWithinLimit(input)) return invalid("La búsqueda debe tener un máximo de 500 caracteres.");
  const tokens = tokenize(input);
  const residual: number[] = [];
  let result: CriteriaResult = { criteria: {} };
  let recognized = false;
  for (let index = 0; index < tokens.length;) {
    const token = tokens[index];
    if (!token.quoted && /^-?["“«]/.test(token.text)) return invalid("Cierra las comillas de la frase que quieres buscar.");
    // Empty quote tokens act as boundaries, so no phrase can span a literal name.
    const words = tokens.slice(index, index + 7).map(({ word }) => word).join(" ");
    const phrase = readPrice(words, tokens, index, market) ?? readAttribute(words, tokens[index - 1]?.word);
    if (phrase) {
      if ("error" in phrase) return invalid(phrase.error);
      result = intersectCriteria(result.criteria, phrase.criteria);
      if (result.error) return result;
      index += phrase.count;
      recognized = true;
    } else {
      const error = unsupportedBudget(words, token.word);
      if (error) return invalid(error);
      residual.push(index);
      index++;
    }
  }
  if (recognized && residual.some((index) => /\b(?:not|no|without|sin|except|excepto|or|o|ni|non|either|neither|\w+n[’']t)\b/.test(tokens[index].word))) {
    return invalid("La búsqueda contiene una negación o una alternativa. Indica una sola opción para cada filtro.");
  }
  const remaining = new Set(residual);
  const text = residual.filter((index) => {
    if (!recognized || !["and", "y"].includes(tokens[index].word)) return true;
    return remaining.has(index - 1) && remaining.has(index + 1);
  }).map((index) => tokens[index].text).join(" ").trim();
  return validateSearchCriteria({ ...result.criteria, ...(text && { text }) });
}
