import { parse as parseYaml } from "yaml";

/**
 * Blog posts live in `content/posts/<slug>.mdx`. This module is pure (no fs) so
 * tests and the page metadata can load it; the reader is `posts.server.ts`.
 */
export const POSTS_DIR = "content/posts";

export type PostMeta = {
  slug: string;
  title: string;
  /** Optional concise search title; the full editorial title remains the h1. */
  seoTitle?: string;
  description: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  updated?: string;
  /** Drafts render in development only. */
  draft: boolean;
};

export type Post = PostMeta & { body: string };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Also what keeps a request's slug from reaching outside the posts folder. */
export function isValidSlug(slug: string) {
  return SLUG.test(slug);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  // JavaScript rolls 2026-02-30 over to March rather than refusing it.
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function readFrontmatter(yaml: string, file: string) {
  try {
    return (parseYaml(yaml) ?? {}) as Record<string, unknown>;
  } catch (error) {
    throw new Error(`${file}: frontmatter is not valid YAML (${(error as Error).message})`);
  }
}

/** Split YAML frontmatter from an MDX file and validate it. Throws with the file name. */
export function parsePost(raw: string, slug: string): Post {
  const file = `${POSTS_DIR}/${slug}.mdx`;
  if (!isValidSlug(slug)) throw new Error(`${file}: slug must be lowercase words joined by hyphens`);

  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error(`${file}: missing --- frontmatter block`);

  const { title, seoTitle, description, date, updated, draft = false } = readFrontmatter(match[1], file);

  if (typeof title !== "string" || !title.trim()) throw new Error(`${file}: title is required`);
  if (typeof description !== "string" || !description.trim()) throw new Error(`${file}: description is required`);
  if (seoTitle !== undefined && (typeof seoTitle !== "string" || !seoTitle.trim())) {
    throw new Error(`${file}: seoTitle must be a nonempty string`);
  }
  if (!isIsoDate(date)) throw new Error(`${file}: date must be YYYY-MM-DD`);
  if (updated !== undefined && !isIsoDate(updated)) throw new Error(`${file}: updated must be YYYY-MM-DD`);
  if (updated !== undefined && updated < date) throw new Error(`${file}: updated must not precede date`);
  if (typeof draft !== "boolean") throw new Error(`${file}: draft must be true or false`);

  return {
    slug,
    title: title.trim(),
    seoTitle: typeof seoTitle === "string" ? seoTitle.trim() : undefined,
    description: description.trim(),
    date,
    updated,
    draft,
    body: match[2],
  };
}

export function isVisible(post: Pick<PostMeta, "draft">, production: boolean) {
  return !post.draft || !production;
}

/** Newest first; slug breaks ties so the order is stable. */
export function sortPosts<T extends Pick<PostMeta, "date" | "slug">>(posts: T[]) {
  return [...posts].sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

// A post's date is a calendar day, not an instant, so it is read and written in
// UTC: any other zone could show the day before.
const dateFormat = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatPostDate(date: string) {
  return dateFormat.format(new Date(`${date}T00:00:00Z`));
}
