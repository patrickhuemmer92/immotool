import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { readTenantScoreWeights } from "@/lib/calculations/tenant";
import { SettingsForm } from "./settings-form";

export default async function SettingsGeneralPage() {
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("settings")
    .select(
      "tax_rate, default_depreciation_rate, default_locale, default_currency, tenant_score_weights"
    )
    .eq("workspace_id", active.id)
    .single();

  if (!settings) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        {t("errors.generic")}
      </p>
    );
  }

  return (
    <SettingsForm
      defaults={{
        tax_rate: Number(settings.tax_rate),
        default_depreciation_rate: Number(settings.default_depreciation_rate),
        default_locale: settings.default_locale as "de" | "en",
        default_currency: settings.default_currency,
        tenant_score_weights: readTenantScoreWeights(
          settings.tenant_score_weights
        ),
      }}
      readOnly={active.role === "viewer"}
    />
  );
}
