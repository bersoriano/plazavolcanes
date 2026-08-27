#!/usr/bin/env node
// Fails the build when a required legal document has no approved, published
// version — unless docs/legal/launch-state.json declares pre_launch and
// acknowledges exactly which types are missing. The declaration is checked in
// so the decision is reviewable, rather than an environment flag that behaves
// one way locally and another in production.

import { readFile } from "node:fs/promises";
import process from "node:process";

const REQUIRED_TYPES = [
  "platform_terms", "privacy_notice", "returns_policy", "warranty_policy",
  "shipping_policy", "security_guidance", "complaints_policy", "seller_terms",
  "buyer_terms", "marketplace_role",
];

const IDENTITY_VARS = [
  "PLAZA_LEGAL_ENTITY_NAME", "PLAZA_LEGAL_RFC", "PLAZA_LEGAL_ADDRESS",
  "PLAZA_LEGAL_EMAIL", "PLAZA_LEGAL_PHONE", "PLAZA_LEGAL_ATTENTION_HOURS",
  "PLAZA_PRIVACY_CONTACT",
];

function fail(lines) {
  console.error("\n✗ legal:verify\n");
  for (const line of lines) console.error(`  ${line}`);
  console.error("\nBuild aborted.\n");
  process.exit(1);
}

async function readLaunchState() {
  try {
    return JSON.parse(await readFile("docs/legal/launch-state.json", "utf8"));
  } catch {
    return null;
  }
}

async function readPublishedTypes() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;

  // Published versions are readable by anon, so the publishable key is enough
  // and no secret is introduced into the build environment.
  const endpoint =
    `${url}/rest/v1/legal_document_versions` +
    `?select=document_type&status=eq.published&effective_at=lte.${new Date().toISOString()}`;

  const response = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });

  if (!response.ok) return null;
  const rows = await response.json();
  // A 200 carrying a non-array body (a PostgREST error object, a content
  // negotiation surprise) must degrade like an unreachable database, not throw
  // a raw stack trace out of the gate.
  if (!Array.isArray(rows)) return null;
  return new Set(rows.map((row) => row.document_type));
}

// Real drift protection for the registry: the TypeScript list and the
// migration seed are two copies of the same truth, and only this check
// reconciles them against the database itself.
async function readSeededTypes(url, key) {
  if (!url || !key) return null;
  const response = await fetch(`${url}/rest/v1/legal_documents?select=type,is_required`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) ? rows : null;
}

const launchState = await readLaunchState();
const missingVars = IDENTITY_VARS.filter((name) => !process.env[name]?.trim());

// Registry drift is a code bug, not a launch-state condition, so it is checked
// FIRST and fails regardless of pre_launch. It must not sit behind the
// published-versions lookup: that lookup exits early when the database is
// unreachable, which is the path a build takes whenever it points at a project
// the legal migrations have not been applied to — exactly when drift would go
// unnoticed.
const seeded = await readSeededTypes(
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
);

if (seeded) {
  const seededRequired = seeded.filter((row) => row.is_required).map((row) => row.type).sort();
  const expected = [...REQUIRED_TYPES].sort();
  const drifted =
    seededRequired.length !== expected.length ||
    seededRequired.some((type, index) => type !== expected[index]);

  if (drifted) {
    fail([
      "the legal document registry disagrees with the database seed:",
      `  code:     ${expected.join(", ")}`,
      `  database: ${seededRequired.join(", ")}`,
      "",
      "reconcile lib/legal/document-types.ts with the migration seed.",
    ]);
  }
} else {
  // Silence here would let a maintainer believe drift protection ran.
  console.warn("⚠ legal:verify  registry drift check skipped — legal_documents unreadable");
}

const published = await readPublishedTypes();

if (published === null) {
  const detail = "cannot reach the database to check published legal documents";
  if (launchState?.status === "pre_launch") {
    console.warn(`\n⚠ legal:verify  ${detail} (pre_launch, continuing)\n`);
    process.exit(0);
  }
  fail([detail, "set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]);
}

const unpublished = REQUIRED_TYPES.filter((type) => !published.has(type));

if (unpublished.length === 0 && missingVars.length === 0) {
  console.log(`✓ legal:verify  ${REQUIRED_TYPES.length} required documents published`);
  process.exit(0);
}

if (launchState?.status === "pre_launch") {
  const acknowledgedList = launchState.acknowledged_unpublished ?? [];
  if (!Array.isArray(acknowledgedList)) {
    fail(["acknowledged_unpublished in docs/legal/launch-state.json must be an array"]);
  }
  const acknowledged = new Set(acknowledgedList);
  const unacknowledged = unpublished.filter((type) => !acknowledged.has(type));

  if (unacknowledged.length > 0) {
    fail([
      "pre_launch is declared but these types are not acknowledged:",
      ...unacknowledged.map((type) => `  ${type}`),
      "",
      "add them to acknowledged_unpublished in docs/legal/launch-state.json",
    ]);
  }

  console.warn(
    `\n⚠ legal:verify  pre_launch — ${unpublished.length} of ` +
      `${REQUIRED_TYPES.length} documents unpublished, ` +
      `${missingVars.length} identity variables unset. No document can be ` +
      `published or accepted.\n`,
  );
  process.exit(0);
}

fail([
  ...unpublished.map((type) => `${type.padEnd(20)} no approved published version`),
  ...missingVars.map((name) => `${name.padEnd(20)} not configured`),
  "",
  `${unpublished.length} of ${REQUIRED_TYPES.length} required document types unpublished.`,
]);
