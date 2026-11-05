import { ArrowRight } from "lucide-react";

import { Eyebrow, TYPE } from "@/components/home/landing/primitives";
import { ButtonLink } from "@/components/ui/button";
import type { PostMeta } from "@/lib/posts";
import { postPath } from "@/lib/seo/blog";

/**
 * A post from the blog, briefed for sellers on their way down the landing. The
 * title and the brief are the post's own, so the two can't drift apart.
 */
export function LandingArticle({ post }: { post: PostMeta }) {
  return (
    <section
      aria-labelledby="articulo-heading"
      className="scroll-mt-20 px-5 pt-14 sm:px-8 lg:scroll-mt-24 lg:pt-24 xl:px-20"
      id="articulo"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-5 rounded-[28px] bg-lime-tint p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between lg:gap-12 lg:p-12">
        <div className="flex flex-col gap-3.5 lg:max-w-[760px] lg:gap-4">
          <Eyebrow>Del blog</Eyebrow>
          <h2 className={`${TYPE.h2} text-ink`} id="articulo-heading">
            {post.title}
          </h2>
        </div>
        <div className="flex flex-col items-start gap-5 lg:max-w-[360px]">
          <p className={TYPE.aside}>{post.description}</p>
          <ButtonLink className="gap-2" href={postPath(post.slug)} size="lg">
            Leer el artículo
            <ArrowRight aria-hidden="true" className="size-5" strokeWidth={2.2} />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
