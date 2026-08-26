// Routes, the footer, and the build gate all read from this registry.
// Unit tests guarantee internal consistency: no duplicates, all labels populated,
// exactly two types are unrouted (buyer_terms and marketplace_role).
// Reconciliation against the database seed (public.legal_documents) happens
// in the build gate (scripts/legal-verify.mjs), which reads the live schema
// and fails the build when the two disagree.

export const LEGAL_DOCUMENT_TYPES = [
  "platform_terms",
  "privacy_notice",
  "returns_policy",
  "warranty_policy",
  "shipping_policy",
  "security_guidance",
  "complaints_policy",
  "seller_terms",
  "buyer_terms",
  "marketplace_role",
] as const;

export type LegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[number];

export const REQUIRED_LEGAL_TYPES: readonly LegalDocumentType[] =
  LEGAL_DOCUMENT_TYPES;

export type LegalRoute = {
  type: LegalDocumentType;
  path: string;
  /** Short label for the footer. */
  navLabel: string;
  /** Fallback page title while no version is published. */
  title: string;
};

export const LEGAL_ROUTES: readonly LegalRoute[] = [
  { type: "platform_terms", path: "/terminos", navLabel: "Términos", title: "Términos y condiciones" },
  { type: "privacy_notice", path: "/privacidad", navLabel: "Privacidad", title: "Aviso de privacidad" },
  { type: "returns_policy", path: "/compras-y-devoluciones", navLabel: "Compras y devoluciones", title: "Compras, cancelaciones y devoluciones" },
  { type: "warranty_policy", path: "/garantias", navLabel: "Garantías", title: "Garantías" },
  { type: "shipping_policy", path: "/envios", navLabel: "Envíos", title: "Envíos y entregas" },
  { type: "security_guidance", path: "/seguridad", navLabel: "Seguridad", title: "Seguridad y prevención de fraude" },
  { type: "complaints_policy", path: "/quejas-y-aclaraciones", navLabel: "Quejas y aclaraciones", title: "Quejas y aclaraciones" },
  { type: "seller_terms", path: "/terminos-vendedores", navLabel: "Términos para vendedores", title: "Términos para vendedores" },
] as const;
