import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/lib/database.types";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function createServerSupabaseClient({ strictCookies = false } = {}) {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseConfig();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch (error) {
          // Auth callbacks must not report success if the browser session was
          // never written. Server Components still rely on proxy refresh.
          if (strictCookies) throw error;
          // Server Components cannot write cookies. Proxy refreshes sessions.
        }
      },
    },
  });
}
