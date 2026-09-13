/**
 * Structured data for search engines, as the page's own <script>.
 *
 * JSON.stringify leaves "<" alone, so text a seller wrote could close the script
 * and start markup of its own; escaping it keeps the JSON identical once parsed.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
      type="application/ld+json"
    />
  );
}
