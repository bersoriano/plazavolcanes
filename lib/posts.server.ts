import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import * as runtime from "react/jsx-runtime";

import { evaluate } from "@mdx-js/mdx";
import type { MDXContent } from "mdx/types";
import remarkGfm from "remark-gfm";

import { isValidSlug, isVisible, parsePost, sortPosts, type Post } from "@/lib/posts";

const isProduction = () => process.env.NODE_ENV === "production";

// The folder is spelled out here, not taken from POSTS_DIR, on purpose. The
// build traces which files these reads can reach to ship them with the route,
// and it cannot follow an imported constant: it would trace the whole
// repository (docs, migrations, tests). A test checks the two stay equal.
export const POSTS_ROOT = path.join(process.cwd(), "content/posts");

async function readPost(slug: string): Promise<Post | null> {
  if (!isValidSlug(slug)) return null;

  try {
    return parsePost(await fs.readFile(path.join(POSTS_ROOT, `${slug}.mdx`), "utf8"), slug);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function listSlugs() {
  try {
    const entries = await fs.readdir(POSTS_ROOT, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
      .map((entry) => entry.name.replace(/\.mdx$/, ""));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

/** Visible posts, newest first. Drafts show in development only. */
export const getPosts = cache(async () => {
  const posts = await Promise.all((await listSlugs()).map(readPost));
  return sortPosts(posts.filter((post): post is Post => !!post && isVisible(post, isProduction())));
});

export const getPost = cache(async (slug: string) => {
  const post = await readPost(slug);
  return post && isVisible(post, isProduction()) ? post : null;
});

// Evaluating MDX runs the code in it, which is safe only because posts are
// repository content: never pass this anything a visitor or seller wrote.
// Each post compiles once per server instance in production, and on every
// request in development so edits show on reload.
const compiled = new Map<string, Promise<MDXContent>>();

export function compilePost(post: Post): Promise<MDXContent> {
  const hit = isProduction() ? compiled.get(post.slug) : undefined;
  if (hit) return hit;

  const result = evaluate(post.body, {
    ...runtime,
    remarkPlugins: [remarkGfm],
    remarkRehypeOptions: {
      // GFM footnotes (`[^id]`) close the post as a visible list of sources.
      footnoteLabel: "Fuentes",
      footnoteLabelProperties: {},
      footnoteBackLabel: (index, rereference) =>
        `Volver a la referencia ${index + 1}${rereference > 1 ? `-${rereference}` : ""}`,
    },
  }).then((module) => module.default);

  if (isProduction()) compiled.set(post.slug, result);
  return result;
}
