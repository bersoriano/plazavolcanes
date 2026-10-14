import { z } from "zod";

export const NOTICE_AUDIENCES = ["person", "everyone", "sellers", "buyers"] as const;
export type NoticeAudience = (typeof NOTICE_AUDIENCES)[number];

/** The audiences an announcement can go to: everything but one person. */
export const BROADCAST_AUDIENCES = ["everyone", "sellers", "buyers"] as const;
export type BroadcastAudience = (typeof BROADCAST_AUDIENCES)[number];

/**
 * A path inside the site and nothing else: one leading slash, then a closed set
 * of characters. The database holds the same rule. The set is closed on purpose,
 * because a browser drops tabs and line breaks from a URL, which would turn
 * "/<tab>/other.site" into a link to another site.
 */
const INTERNAL_PATH = /^\/([A-Za-z0-9_.~%-][A-Za-z0-9/_.~%?=&#-]*)?$/;

export function isInternalPath(value: string) {
  return INTERNAL_PATH.test(value);
}

/** A form sends an empty field as "", and a missing one not at all. */
const text = z.preprocess((value) => (typeof value === "string" ? value.trim() : ""), z.string());

export const platformNoticeSchema = z
  .object({
    title: text.pipe(
      z
        .string()
        .min(1, "Escribe un título.")
        .max(120, "El título debe tener 120 caracteres o menos."),
    ),
    body: text.pipe(
      z
        .string()
        .min(1, "Escribe un mensaje.")
        .max(2000, "El mensaje debe tener 2000 caracteres o menos."),
    ),
    action_href: text,
    action_label: text,
  })
  .superRefine((notice, context) => {
    if (notice.action_href && notice.action_href.length > 300) {
      context.addIssue({
        code: "custom",
        message: "El enlace debe tener 300 caracteres o menos.",
        path: ["action_href"],
      });
    } else if (notice.action_href && !isInternalPath(notice.action_href)) {
      context.addIssue({
        code: "custom",
        message: "El enlace debe empezar con / y quedarse dentro de la plaza.",
        path: ["action_href"],
      });
    }

    if (notice.action_href && !notice.action_label) {
      context.addIssue({
        code: "custom",
        message: "Escribe el texto del botón.",
        path: ["action_label"],
      });
    }
    if (!notice.action_href && notice.action_label) {
      context.addIssue({
        code: "custom",
        message: "El texto del botón necesita un enlace.",
        path: ["action_href"],
      });
    }
    if (notice.action_label.length > 40) {
      context.addIssue({
        code: "custom",
        message: "El texto del botón debe tener 40 caracteres o menos.",
        path: ["action_label"],
      });
    }
  })
  .transform((notice) => ({
    ...notice,
    action_href: notice.action_href || null,
    action_label: notice.action_label || null,
  }));

export type PlatformNoticeInput = z.infer<typeof platformNoticeSchema>;
