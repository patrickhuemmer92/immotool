"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type AuthState =
  | { error?: string; emailSent?: boolean; success?: boolean }
  | undefined;

async function originUrl(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export async function login(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect(redirectTo);
}

/**
 * Sign up. If the Supabase project has "Confirm email" enabled, the user will
 * receive a confirmation email and we surface the "check your inbox" screen
 * via {@link AuthState.emailSent}. If confirmation is disabled, Supabase
 * returns a session immediately and we redirect into the app.
 */
export async function signup(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const consent = formData.get("consent") === "on" || formData.get("consent") === "true";
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard");
  const origin = await originUrl();

  // DSGVO: Akzeptanz von AGB + Datenschutz vor Account-Anlage ist Pflicht.
  if (!consent) {
    return { error: "consent_required" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(
        redirectTo
      )}`,
      // Zustimmung mit Zeitstempel im user_metadata speichern —
      // dokumentiert die Einwilligung gemäß Art. 7 Abs. 1 DSGVO.
      data: {
        consent_accepted_at: new Date().toISOString(),
        consent_version: "1.0",
      },
    },
  });

  if (error) return { error: error.message };

  if (data.session) {
    revalidatePath("/", "layout");
    redirect(redirectTo);
  }

  return { emailSent: true };
}

/**
 * Send a password-reset email. The link in the email points at our auth
 * callback with `next=/passwort-zuruecksetzen`, so the user lands on the
 * "set new password" page with a valid recovery session.
 */
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  if (!email) return { error: "email_required" };

  const origin = await originUrl();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(
      "/passwort-zuruecksetzen"
    )}`,
  });

  if (error) return { error: error.message };
  return { emailSent: true };
}

/**
 * Apply a new password. Caller must already have a (recovery) session — the
 * callback route exchanges the recovery code into a session before redirecting
 * here.
 */
export async function updatePassword(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) return { error: "password_too_short" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: true };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
