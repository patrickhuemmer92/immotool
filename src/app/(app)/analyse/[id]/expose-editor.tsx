"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ExposeExtraction } from "@/lib/dd/schemas/expose";
import { saveExtractedExposeEdit } from "../actions";

/**
 * Zeigt die extrahierten Exposé-Felder als editierbare Karte.
 * Kern-Prinzip: jede KI-erkannte Zahl ist mit einem kleinen „KI"-Badge
 * markiert — Nutzer weiß, was aus dem Doku kam und was er selbst
 * getippt hat.
 *
 * Speichert per Server-Action zurück nach dd_projects.extracted_expose.
 */
export function ExposeEditor({
  projectId,
  expose,
}: {
  projectId: string;
  expose: ExposeExtraction;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [values, setValues] = useState({
    kind: expose.kind ?? "",
    street: expose.street ?? "",
    postal_code: expose.postal_code ?? "",
    city: expose.city ?? "",
    purchase_price_eur:
      expose.purchase_price_eur == null ? "" : String(expose.purchase_price_eur),
    living_area_sqm:
      expose.living_area_sqm == null ? "" : String(expose.living_area_sqm),
    rooms: expose.rooms == null ? "" : String(expose.rooms),
    build_year: expose.build_year == null ? "" : String(expose.build_year),
    energy_class: expose.energy_class,
    energy_kwh_per_sqm_a:
      expose.energy_kwh_per_sqm_a == null
        ? ""
        : String(expose.energy_kwh_per_sqm_a),
    heating_kind: expose.heating_kind,
    heating_year:
      expose.heating_year == null ? "" : String(expose.heating_year),
    hoa_fee_per_month_eur:
      expose.hoa_fee_per_month_eur == null
        ? ""
        : String(expose.hoa_fee_per_month_eur),
    current_cold_rent_per_month_eur:
      expose.current_cold_rent_per_month_eur == null
        ? ""
        : String(expose.current_cold_rent_per_month_eur),
  });

  function num(v: string): number | null {
    if (v.trim() === "") return null;
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  function onSave() {
    setError(null);
    setSavedFlash(false);
    startSave(async () => {
      const patch = {
        kind: values.kind === "" ? null : values.kind,
        street: values.street === "" ? null : values.street,
        postal_code: values.postal_code === "" ? null : values.postal_code,
        city: values.city === "" ? null : values.city,
        purchase_price_eur: num(values.purchase_price_eur),
        living_area_sqm: num(values.living_area_sqm),
        rooms: num(values.rooms),
        build_year: num(values.build_year),
        energy_class: values.energy_class,
        energy_kwh_per_sqm_a: num(values.energy_kwh_per_sqm_a),
        heating_kind: values.heating_kind,
        heating_year: num(values.heating_year),
        hoa_fee_per_month_eur: num(values.hoa_fee_per_month_eur),
        current_cold_rent_per_month_eur: num(values.current_cold_rent_per_month_eur),
      };
      const result = await saveExtractedExposeEdit(projectId, patch);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSavedFlash(true);
      router.refresh();
      setTimeout(() => setSavedFlash(false), 2000);
    });
  }

  const eurPerSqm =
    num(values.purchase_price_eur) && num(values.living_area_sqm)
      ? Math.round(
          num(values.purchase_price_eur)! / num(values.living_area_sqm)!
        )
      : null;

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-6">
      {/* KI-Hinweis + Kurzzusammenfassung */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <KiBadge />
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {t("dd.editor_ai_hint")}
            </span>
          </div>
          {expose.short_summary && (
            <span className="text-[11px] text-neutral-400 truncate max-w-md">
              {expose.short_summary}
            </span>
          )}
        </div>
      </div>

      {/* Kernfelder */}
      <Section title={t("dd.editor_section_core")}>
        <Grid>
          <Field label={t("dd.f_kind")}>
            <select
              value={values.kind}
              onChange={(e) => setValues({ ...values, kind: e.target.value })}
              className={inputClass}
            >
              <option value="">—</option>
              <option value="apartment">{t("properties.kind_apartment")}</option>
              <option value="house">{t("properties.kind_house")}</option>
              <option value="row_house">{t("dd.kind_row_house")}</option>
              <option value="commercial">{t("properties.kind_commercial")}</option>
              <option value="parking">{t("properties.kind_parking")}</option>
              <option value="other">{t("properties.kind_other")}</option>
            </select>
          </Field>
          <Field label={t("dd.f_street")}>
            <input
              type="text"
              value={values.street}
              onChange={(e) =>
                setValues({ ...values, street: e.target.value })
              }
              className={inputClass}
            />
          </Field>
          <Field label={t("dd.f_postal_code")}>
            <input
              type="text"
              value={values.postal_code}
              onChange={(e) =>
                setValues({ ...values, postal_code: e.target.value })
              }
              className={inputClass}
            />
          </Field>
          <Field label={t("dd.f_city")}>
            <input
              type="text"
              value={values.city}
              onChange={(e) => setValues({ ...values, city: e.target.value })}
              className={inputClass}
            />
          </Field>
        </Grid>
      </Section>

      {/* Wirtschaftsdaten */}
      <Section title={t("dd.editor_section_finance")}>
        <Grid>
          <Field label={t("dd.f_purchase_price")}>
            <input
              type="text"
              inputMode="decimal"
              value={values.purchase_price_eur}
              onChange={(e) =>
                setValues({ ...values, purchase_price_eur: e.target.value })
              }
              className={inputClass}
            />
          </Field>
          <Field label={t("dd.f_living_area")}>
            <input
              type="text"
              inputMode="decimal"
              value={values.living_area_sqm}
              onChange={(e) =>
                setValues({ ...values, living_area_sqm: e.target.value })
              }
              className={inputClass}
            />
          </Field>
          <Field label={t("dd.f_rooms")}>
            <input
              type="text"
              inputMode="decimal"
              value={values.rooms}
              onChange={(e) => setValues({ ...values, rooms: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label={t("dd.f_build_year")}>
            <input
              type="text"
              inputMode="numeric"
              value={values.build_year}
              onChange={(e) =>
                setValues({ ...values, build_year: e.target.value })
              }
              className={inputClass}
            />
          </Field>
          <Field label={t("dd.f_hoa_fee")}>
            <input
              type="text"
              inputMode="decimal"
              value={values.hoa_fee_per_month_eur}
              onChange={(e) =>
                setValues({
                  ...values,
                  hoa_fee_per_month_eur: e.target.value,
                })
              }
              className={inputClass}
            />
          </Field>
          <Field label={t("dd.f_current_rent")}>
            <input
              type="text"
              inputMode="decimal"
              value={values.current_cold_rent_per_month_eur}
              onChange={(e) =>
                setValues({
                  ...values,
                  current_cold_rent_per_month_eur: e.target.value,
                })
              }
              className={inputClass}
            />
          </Field>
        </Grid>
        {eurPerSqm != null && (
          <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
            {t("dd.derived_eur_per_sqm", { value: eurPerSqm.toLocaleString("de-DE") })}
          </p>
        )}
      </Section>

      {/* Energie */}
      <Section title={t("dd.editor_section_energy")}>
        <Grid>
          <Field label={t("dd.f_energy_class")}>
            <select
              value={values.energy_class}
              onChange={(e) =>
                setValues({
                  ...values,
                  energy_class: e.target.value as ExposeExtraction["energy_class"],
                })
              }
              className={inputClass}
            >
              {[
                "UNKNOWN",
                "A_PLUS",
                "A",
                "B",
                "C",
                "D",
                "E",
                "F",
                "G",
                "H",
              ].map((c) => (
                <option key={c} value={c}>
                  {c === "UNKNOWN" ? "—" : c === "A_PLUS" ? "A+" : c}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("dd.f_energy_kwh")}>
            <input
              type="text"
              inputMode="decimal"
              value={values.energy_kwh_per_sqm_a}
              onChange={(e) =>
                setValues({
                  ...values,
                  energy_kwh_per_sqm_a: e.target.value,
                })
              }
              className={inputClass}
            />
          </Field>
          <Field label={t("dd.f_heating_kind")}>
            <select
              value={values.heating_kind}
              onChange={(e) =>
                setValues({
                  ...values,
                  heating_kind: e.target.value as ExposeExtraction["heating_kind"],
                })
              }
              className={inputClass}
            >
              {[
                "unknown",
                "gas",
                "oil",
                "heat_pump",
                "district_heating",
                "wood_pellets",
                "electric",
                "solar_thermal_combo",
                "other",
              ].map((k) => (
                <option key={k} value={k}>
                  {t(`dd.heating_${k}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("dd.f_heating_year")}>
            <input
              type="text"
              inputMode="numeric"
              value={values.heating_year}
              onChange={(e) =>
                setValues({ ...values, heating_year: e.target.value })
              }
              className={inputClass}
            />
          </Field>
        </Grid>
      </Section>

      {/* Makler-Sprech */}
      {expose.agent_speak_flags.length > 0 && (
        <Section title={t("dd.agent_speak_section")}>
          <ul className="space-y-2">
            {expose.agent_speak_flags.map((f, i) => (
              <li
                key={i}
                className={`rounded-lg border p-3 text-sm ${
                  f.concern_level === "high"
                    ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30"
                    : f.concern_level === "medium"
                      ? "border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30"
                      : "border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50"
                }`}
              >
                <p className="italic text-neutral-700 dark:text-neutral-300">
                  „{f.quote}"
                </p>
                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                  <strong>{t("dd.means")}:</strong> {f.translation}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Fehlende Pflichtangaben */}
      {expose.missing_mandatory.length > 0 && (
        <Section title={t("dd.missing_section")}>
          <ul className="text-sm text-neutral-700 dark:text-neutral-300 list-disc list-inside">
            {expose.missing_mandatory.map((m) => (
              <li key={m}>{t(`dd.missing_${m}`, { default: m })}</li>
            ))}
          </ul>
          {/* Kontext-abhängiger Hinweis. GEG/EnEV kennt Ausnahmen:
              - Baujahr vor 1918 UND unter Denkmalschutz → häufig komplett befreit
              - Denkmalschutz allein → oft befreit
              - Alle anderen → Angaben sind Pflicht bei Verkauf / Neuvermietung
              Wir zeigen daher drei Textvarianten je nach Kontext, statt
              pauschal „ist Pflicht" zu behaupten. */}
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {(() => {
              const buildYear = num(values.build_year);
              const heritage = expose.is_heritage_protected === true;
              if (heritage) return t("dd.missing_hint_heritage");
              if (buildYear != null && buildYear < 1918)
                return t("dd.missing_hint_prewar");
              return t("dd.missing_hint");
            })()}
          </p>
        </Section>
      )}

      {/* Save-Button */}
      <div className="flex items-center gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? t("common.loading") : t("dd.save_edits")}
        </button>
        {savedFlash && (
          <span className="text-sm text-green-600 dark:text-green-400">
            ✓ {t("dd.saved")}
          </span>
        )}
        {error && (
          <span className="text-sm text-red-600 dark:text-red-400">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent";

function KiBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-accent-soft border border-accent/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground">
      KI
    </span>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1">{label}</label>
      {children}
    </div>
  );
}
