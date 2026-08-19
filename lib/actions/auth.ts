"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authSchema } from "@/lib/validation/auth";

function parseCredentials(formData: FormData) {
  return authSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
}

const setupError: ActionState = {
  status: "error",
  message:
    "Conecta tu proyecto de Supabase en .env.local para activar el acceso.",
};

export async function signIn(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseCredentials(formData);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisa los campos marcados.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  if (!isSupabaseConfigured()) {
    return setupError;
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return {
      status: "error",
      message: "Correo o contraseña incorrectos.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/panel");
}

export async function signUp(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseCredentials(formData);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisa los campos marcados.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  if (!isSupabaseConfigured()) {
    return setupError;
  }

  const supabase = await createServerSupabaseClient();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm`,
    },
  });

  if (error) {
    return {
      status: "error",
      message: "No pudimos crear la cuenta. Inténtalo de nuevo.",
    };
  }

  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/panel");
  }

  return {
    status: "success",
    message: "Revisa tu correo para confirmar tu cuenta.",
  };
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getClaims();

    if (data?.claims) {
      await supabase.auth.signOut();
    }
  }

  revalidatePath("/", "layout");
  redirect("/");
}
