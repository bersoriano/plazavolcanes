"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { buildSiteUrl } from "@/lib/site-url";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authSchema, displayNameSchema, phoneSchema, signUpSchema } from "@/lib/validation/auth";

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
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone"),
    display_name: formData.get("display_name"),
  });

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
  const { email, password, phone, display_name: displayName } = parsed.data;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Triggers copy these into user_contact_details and user_display_names,
      // which works whether or not email confirmation leaves the new account
      // with a session.
      data: { phone, display_name: displayName },
      emailRedirectTo: buildSiteUrl("/auth/confirm"),
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

export async function updatePhone(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = phoneSchema.safeParse({ phone: formData.get("phone") });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisa los campos marcados.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  if (!isSupabaseConfigured()) return setupError;

  const supabase = await createServerSupabaseClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;

  if (!userId) {
    return { status: "error", message: "Tu sesión terminó. Ingresa nuevamente." };
  }

  const { error } = await supabase
    .from("user_contact_details")
    .update({ phone: parsed.data.phone, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (error) {
    return { status: "error", message: "No pudimos guardar tu teléfono." };
  }

  revalidatePath("/panel/cuenta");
  return { status: "success", message: "Teléfono actualizado." };
}

export async function updateDisplayName(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = displayNameSchema.safeParse(formData.get("display_name"));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisa los campos marcados.",
      errors: { display_name: parsed.error.issues.map((issue) => issue.message) },
    };
  }

  if (!isSupabaseConfigured()) return setupError;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("set_display_name", { p_display_name: parsed.data });

  if (error) {
    return { status: "error", message: "No pudimos guardar tu nombre." };
  }

  revalidatePath("/panel/cuenta");
  return { status: "success", message: "Nombre actualizado." };
}
