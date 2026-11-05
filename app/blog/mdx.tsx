import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import styles from "./blog.module.css";

/**
 * How post Markdown maps to site markup. Site links navigate within the app,
 * external links open safely, and images are local files under `public/` (the
 * tests reject remote images). `<Takeaway>` is the boxed summary a post can
 * open with.
 */
export const postComponents: MDXComponents = {
  a: ({ href = "", ...props }: ComponentProps<"a">) => {
    if (/^https?:\/\//.test(href)) return <a {...props} href={href} rel="noopener noreferrer" />;
    if (href.startsWith("/") && !href.startsWith("//")) return <Link {...props} href={href} />;
    // Footnote anchors and mailto: are ordinary links.
    return <a {...props} href={href} />;
  },
  img: ({ alt = "", ...props }: ComponentProps<"img">) => (
    // eslint-disable-next-line @next/next/no-img-element -- a post's Markdown does not know its image's size, which next/image requires.
    <img {...props} alt={alt} decoding="async" loading="lazy" />
  ),
  table: (props: ComponentProps<"table">) => (
    <div className={styles.tableWrap}>
      <table {...props} />
    </div>
  ),
  Takeaway: ({ children }: { children?: ReactNode }) => (
    <div className={styles.takeaway} role="note">
      <p className={styles.takeawayLabel}>Punto clave</p>
      {children}
    </div>
  ),
};
