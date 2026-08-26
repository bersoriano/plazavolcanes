import { z } from "zod";

// None of these facts exist yet. Nothing in this codebase invents them: the
// build gate names each missing variable and refuses, and the publish function
// refuses an empty identity. See spec §2.

export const PLATFORM_IDENTITY_VARS = [
  "PLAZA_LEGAL_ENTITY_NAME",
  "PLAZA_LEGAL_RFC",
  "PLAZA_LEGAL_ADDRESS",
  "PLAZA_LEGAL_EMAIL",
  "PLAZA_LEGAL_PHONE",
  "PLAZA_LEGAL_ATTENTION_HOURS",
  "PLAZA_PRIVACY_CONTACT",
] as const;

// Personas morales carry 12 characters, personas físicas 13.
const RFC = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;

const schema = z.object({
  PLAZA_LEGAL_ENTITY_NAME: z.string().trim().min(3),
  PLAZA_LEGAL_RFC: z.string().trim().toUpperCase().regex(RFC),
  PLAZA_LEGAL_ADDRESS: z.string().trim().min(10),
  PLAZA_LEGAL_EMAIL: z.email(),
  PLAZA_LEGAL_PHONE: z.string().trim().regex(/^\+52[0-9]{10}$/),
  PLAZA_LEGAL_ATTENTION_HOURS: z.string().trim().min(5),
  PLAZA_PRIVACY_CONTACT: z.email(),
});

export type PlatformIdentity = {
  entityName: string;
  rfc: string;
  address: string;
  email: string;
  phone: string;
  attentionHours: string;
  privacyContact: string;
};

export type PlatformIdentityResult =
  | { ok: true; identity: PlatformIdentity }
  | { ok: false; missing: string[] };

export function readPlatformIdentity(
  env: Record<string, string | undefined> = process.env,
): PlatformIdentityResult {
  const parsed = schema.safeParse(
    Object.fromEntries(
      PLATFORM_IDENTITY_VARS.map((name) => [name, env[name]?.trim() || undefined]),
    ),
  );

  if (!parsed.success) {
    // A malformed value is reported the same way a missing one is: it cannot be
    // used, and the person fixing it needs the variable name either way.
    const missing = new Set(
      parsed.error.issues.map((issue) => String(issue.path[0])),
    );

    return {
      ok: false,
      missing: PLATFORM_IDENTITY_VARS.filter((name) => missing.has(name)),
    };
  }

  return {
    ok: true,
    identity: {
      entityName: parsed.data.PLAZA_LEGAL_ENTITY_NAME,
      rfc: parsed.data.PLAZA_LEGAL_RFC,
      address: parsed.data.PLAZA_LEGAL_ADDRESS,
      email: parsed.data.PLAZA_LEGAL_EMAIL,
      phone: parsed.data.PLAZA_LEGAL_PHONE,
      attentionHours: parsed.data.PLAZA_LEGAL_ATTENTION_HOURS,
      privacyContact: parsed.data.PLAZA_PRIVACY_CONTACT,
    },
  };
}
