import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Eyebrow, TYPE } from "@/components/home/landing/primitives";
import { ButtonLink } from "@/components/ui/button";
import { formatPostDate, type PostMeta } from "@/lib/posts";
import { BLOG_PATH, postPath } from "@/lib/seo/blog";

/** How many of the newest posts the landing briefs: one featured, the rest listed. */
export const LANDING_POSTS = 3;

/**
 * The newest posts from the blog, briefed for sellers on their way down the
 * landing: the newest leads with its title and brief, the ones before it follow
 * as rows. Titles and briefs are the posts' own, so the two can't drift apart.
 */
export function LandingArticle({ posts }: { posts: PostMeta[] }) {
  const [featured, ...older] = posts.slice(0, LANDING_POSTS);
  if (!featured) return null;

  return (
    <section
      aria-label="Del blog"
      className="scroll-mt-20 px-5 pt-14 sm:px-8 lg:scroll-mt-24 lg:pt-24 xl:px-20"
      id="articulo"
    >
      <div className="mx-auto max-w-[1280px] rounded-[28px] bg-lime-tint p-6 sm:p-8 lg:p-12">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
          <div className="flex flex-col gap-3.5 lg:max-w-[760px] lg:gap-4">
            <Eyebrow>Del blog</Eyebrow>
            <h2 className={`${TYPE.h2} text-ink`}>{featured.title}</h2>
          </div>
          <div className="flex flex-col items-start gap-5 lg:max-w-[360px]">
            <p className={TYPE.aside}>{featured.description}</p>
            <ButtonLink className="gap-2" href={postPath(featured.slug)} size="lg">
              Leer el artículo
              <ArrowRight aria-hidden="true" className="size-5" strokeWidth={2.2} />
            </ButtonLink>
          </div>
        </div>
        {older.length ? (
          <ul className="mt-8 divide-y divide-line border-t border-line">
            {older.map((post) => (
              <li key={post.slug}>
                <Link className="group flex items-center justify-between gap-4 py-5" href={postPath(post.slug)}>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className={`${TYPE.h3} text-ink transition-colors group-hover:text-brand`}>{post.title}</span>
                    <time className="text-sm text-muted" dateTime={post.date}>
                      {formatPostDate(post.date)}
                    </time>
                  </span>
                  <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-brand" strokeWidth={2.2} />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="mx-auto mt-5 flex max-w-[1280px] justify-end">
        <Link className="inline-flex items-center gap-2 font-semibold text-brand underline-offset-4 hover:underline" href={BLOG_PATH}>
          Ver todo el blog
          <ArrowRight aria-hidden="true" className="size-4" strokeWidth={2.2} />
        </Link>
      </div>
    </section>
  );
}
