import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { pct } from "@/lib/format";
import { SettingsForm } from "./settings-form";
import { OwnerTaxRatesForm, type OwnerTaxRow } from "./owner-tax-form";

export default async function SettingsGeneralPage() {
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const [{ data: settings }, { data: owners }] = await Promise.all([
    supabase
      .from("settings")
      .select(
        "tax_rate, default_depreciation_rate, default_locale, default_currency, cashflow_convention, default_vacancy_residential, default_vacancy_commercial, default_management_per_unit, bank_maintenance_per_sqm"
      )
      .eq("workspace_id", active.id)
      .single(),
    supabase
      .from("owners")
      .select(
        "id, name, kind, tax_rate, property_owners(property_id)"
      )
      .eq("workspace_id", active.id)
      .order("kind")
      .order("name"),
  ]);

  if (!settings) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        {t("errors.generic")}
      </p>
    );
  }

  const workspaceTaxRate = Number(settings.tax_rate);
  const ownerRows: OwnerTaxRow[] = (
    (owners ?? []) as unknown as {
      id: string;
      name: string;
      kind: string | null;
      tax_rate: string | number | null;
      property_owners: { property_id: string }[] | null;
    }[]
  ).map((o) => ({
    id: o.id,
    name: o.name,
    kind: o.kind === "group" ? "group" : "person",
    tax_rate: o.tax_rate == null ? null : Number(o.tax_rate),
    propertyCount: o.property_owners?.length ?? 0,
  }));

  return (
    <div className="space-y-10">
      <SettingsForm
        defaults={{
          tax_rate: workspaceTaxRate,
          default_depreciation_rate: Number(settings.default_depreciation_rate),
          default_locale: settings.default_locale as "de" | "en",
          default_currency: settings.default_currency,
          cashflow_convention:
            (settings.cashflow_convention as "net" | "gross") ?? "net",
          default_vacancy_residential: Number(
            settings.default_vacancy_residential ?? 0.02
          ),
          default_vacancy_commercial: Number(
            settings.default_vacancy_commercial ?? 0.04
          ),
          default_management_per_unit: Number(
            settings.default_management_per_unit ?? 0
          ),
          bank_maintenance_per_sqm: Number(
            settings.bank_maintenance_per_sqm ?? 8
          ),
        }}
        readOnly={active.role === "viewer"}
      />

      <section className="border-t border-neutral-200 dark:border-neutral-800 pt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {t("settings.owner_tax_section")}
        </h2>
        <p className="mt-1 mb-4 text-xs text-neutral-500 dark:text-neutral-400 max-w-2xl">
          {t("settings.owner_tax_help", { rate: pct(workspaceTaxRate) })}
        </p>
        <OwnerTaxRatesForm
          owners={ownerRows}
          fallbackRate={workspaceTaxRate}
          readOnly={active.role === "viewer"}
        />
      </section>
    </div>
  );
}
