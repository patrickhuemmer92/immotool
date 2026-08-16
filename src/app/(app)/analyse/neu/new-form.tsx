"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/form-error";
import { createDdProject, type DdProjectState } from "../actions";
import {
  PROPERTY_TYPES,
  type PropertyType,
} from "@/lib/dd/property-type";

const PROPERTY_TYPE_ICONS: Record<PropertyType, string> = {
  etw_weg: "🏢",
  mfh: "🏘️",
  efh: "🏠",
  gewerbe: "🏬",
  mixed: "🏙️",
  other: "📄",
};

export function NewDdProjectForm() {
  const t = useTranslations();
  const [state, action, pending] = useActionState<DdProjectState, FormData>(
    createDdProject,
    undefined
  );
  const [selectedType, setSelectedType] = useState<PropertyType>("etw_weg");

  return (
    <form action={action} className="space-y-6">
      {/* Objektart-Vorwahl: Radio-Cards. Beeinflusst welche Dokumente
          empfohlen werden und wie die KI die Findings erzeugt. */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          {t("dd.field_property_type")}
        </label>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {t("dd.field_property_type_hint")}
        </p>
        <input type="hidden" name="property_type" value={selectedType} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PROPERTY_TYPES.map((pt) => {
            const active = selectedType === pt;
            return (
              <button
                key={pt}
                type="button"
                onClick={() => setSelectedType(pt)}
                className={`text-left rounded-xl border-2 p-3 transition-colors ${
                  active
                    ? "border-accent bg-accent/5"
                    : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
                }`}
              >
                <div className="text-xl leading-none">
                  {PROPERTY_TYPE_ICONS[pt]}
                </div>
                <div className="mt-2 text-sm font-medium">
                  {t(`dd.ptype_${pt}`)}
                </div>
                <div className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug">
                  {t(`dd.ptype_${pt}_desc`)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="name" className="text-sm font-medium">
          {t("dd.field_name")}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder={t("dd.field_name_placeholder")}
          className={inputClass}
        />
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {t("dd.field_name_hint")}
        </p>
      </div>
      <div className="space-y-1">
        <label htmlFor="address_hint" className="text-sm font-medium">
          {t("dd.field_address")}
        </label>
        <input
          id="address_hint"
          name="address_hint"
          type="text"
          placeholder={t("dd.field_address_placeholder")}
          className={inputClass}
        />
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {t("dd.field_address_hint")}
        </p>
      </div>
      <FormError raw={state?.error} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("common.loading") : t("dd.create_and_continue")}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent";
