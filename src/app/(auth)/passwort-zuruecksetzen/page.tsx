import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/wordmark";
import { ResetUpdateForm } from "./reset-update-form";

export default async function ResetPasswordPage() {
  const t = await getTranslations();

  // The auth callback must have created a (recovery) session before the user
  // arrives here. Without it, send them back to the request flow.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/passwort-vergessen");

  return (
    <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
      <div className="mb-6">
        <Wordmark size="lg" tagline />
        <p className="mt-4 text-sm text-neutral-500">
          {t("auth.reset_update_title")}
        </p>
        <p className="mt-1 text-xs text-neutral-500">{user.email}</p>
      </div>
      <ResetUpdateForm />
    </div>
  );
}
