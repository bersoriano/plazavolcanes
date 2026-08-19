const EXAMPLE_URL = "https://your-project.supabase.co";
const EXAMPLE_KEY = "sb_publishable_your-key";

export function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  return Boolean(
    url &&
      publishableKey &&
      url !== EXAMPLE_URL &&
      publishableKey !== EXAMPLE_KEY,
  );
}

export function getSupabaseConfig() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Configura las variables públicas de Supabase antes de continuar.",
    );
  }

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    publishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!.trim(),
  };
}
