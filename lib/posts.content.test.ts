import fs from "node:fs";
import path from "node:path";

import { compile } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";

import { POSTS_DIR, parsePost } from "@/lib/posts";

/**
 * What every post in the repository has to respect. It runs on the files
 * themselves, so a bad post fails `npm test` instead of a page in production.
 */
function contentProblems(body: string, publicFileExists: (publicPath: string) => boolean) {
  const problems: string[] = [];

  // The page already renders the title as the only h1.
  if (/^# /m.test(body.replace(/```[\s\S]*?```/g, ""))) problems.push("h1 in the body");
  if (/\busted\b/i.test(body)) problems.push("usted instead of tú");

  const images = [
    ...body.matchAll(/!\[[^\]]*\]\(\s*([^)\s]+)/g),
    ...body.matchAll(/<img[^>]+src=["']([^"']+)["']/g),
  ].map((match) => match[1]);

  for (const src of images) {
    if (!src.startsWith("/")) problems.push(`remote image ${src}`);
    else if (!publicFileExists(src)) problems.push(`missing image ${src}`);
  }

  return problems;
}

const publicFileExists = (publicPath: string) => fs.existsSync(path.join("public", publicPath));

describe("the content rules", () => {
  it.each([
    ["an h1 in the body", "# Título\n", "h1 in the body"],
    ["usted", "Usted puede vender.\n", "usted instead of tú"],
    ["a remote image", "![foto](https://example.com/a.jpg)\n", "remote image https://example.com/a.jpg"],
    ["a remote img tag", '<img src="https://example.com/a.jpg" />\n', "remote image https://example.com/a.jpg"],
    ["a local image that is missing", "![foto](/blog/no-existe/a.jpg)\n", "missing image /blog/no-existe/a.jpg"],
  ])("catch %s", (_name, body, problem) => {
    expect(contentProblems(body, publicFileExists)).toEqual([problem]);
  });

  it("accept a local image that exists and an h1 shown as code", () => {
    expect(contentProblems("![marca](/favicon-check.png)\n", () => true)).toEqual([]);
    expect(contentProblems("```md\n# Título\n```\n", publicFileExists)).toEqual([]);
  });
});

describe("the posts in the repository", () => {
  const files = fs.readdirSync(POSTS_DIR);

  it("keeps the format template as a draft that never reaches production", () => {
    const template = fs.readFileSync(path.join(POSTS_DIR, "example-post.mdx"), "utf8");

    expect(parsePost(template, "example-post").draft).toBe(true);
  });

  it.each(files)("%s parses, compiles and follows the rules", async (file) => {
    expect(file).toMatch(/\.mdx$/);

    const post = parsePost(fs.readFileSync(path.join(POSTS_DIR, file), "utf8"), file.replace(/\.mdx$/, ""));

    await expect(compile(post.body, { remarkPlugins: [remarkGfm] })).resolves.toBeDefined();
    expect(contentProblems(post.body, publicFileExists)).toEqual([]);
  });
});
