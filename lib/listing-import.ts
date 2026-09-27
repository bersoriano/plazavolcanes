/** How many listing links one import request can carry. */
export const IMPORT_MAX_LINKS = 50;

const LINK = /^https?:\/\/\S+$/i;

/**
 * The links a seller pasted, one per line: trimmed, blanks and repeats
 * dropped. Mirrors public.request_listing_import, which checks again.
 */
export function parseImportLinks(text: string): { links: string[] } | { error: string } {
  const links = [...new Set(text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];

  if (!links.length) return { error: "Pega al menos un enlace." };
  if (links.length > IMPORT_MAX_LINKS) return { error: `Pega hasta ${IMPORT_MAX_LINKS} enlaces por solicitud.` };
  if (links.some((link) => !LINK.test(link) || link.length > 500)) {
    return { error: "Cada línea debe ser un enlace que empiece con https://." };
  }
  return { links };
}
