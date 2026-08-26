const MAX_LENGTH = 512;

/** A path we would be willing to redirect to: this site, no scheme, no host. */
function looksInternal(value: string) {
  // A second leading slash — or a backslash, which some browsers normalise into
  // one — turns "/foo" into "//host/foo" and leaves the site.
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  if (value.includes("\\")) return false;
  // Whitespace and control characters hide a scheme from a naive check and can
  // split headers once the value reaches a Location.
  return !/[\s\u0000-\u001f\u007f]/.test(value);
}

/**
 * Validates a continuation destination that arrived from a form field or query
 * string, returning it unchanged or `null`.
 *
 * Callers redirect to the result, so anything that could name another origin has
 * to fail closed: an absolute URL, a protocol-relative one, a backslash, or an
 * encoding that turns into one of those once the browser decodes it.
 */
export function safeContinuation(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_LENGTH) {
    return null;
  }

  if (!looksInternal(value)) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Malformed percent encoding: refuse rather than guess what was meant.
    return null;
  }

  return looksInternal(decoded) ? value : null;
}
