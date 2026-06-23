"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/modal";
import { createPropertyInline } from "@/app/(app)/objekte/actions";
import { addPropertyToPortfolio } from "../actions";

type Props = {
  portfolioId: string;
  open: boolean;
  onClose: () => void;
};

/**
 * Modal-Dialog "Neues Objekt anlegen und direkt diesem Portfolio
 * hinzufügen". Spart den User-Roundtrip über /objekte/neu →
 * zurück ins Portfolio → manuell aus Dropdown wählen.
 *
 * Wir fragen nur die Pflichtfelder ab (kind + Adresse). Alle weiteren
 * Details (Kaufpreis, AfA, Eigentümer …) trägt der User später über
 * die normale Bearbeiten-Seite nach.
 */
export function InlinePropertyDialog({ portfolioId, open, onClose }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(fd: FormData) {
    setError(null);
    start(async () => {
      // 1) Property anlegen
      const result = await createPropertyInline(undefined, fd);
      if (!result || "error" in result) {
        setError(result?.error ?? "unknown_error");
        return;
      }

      // 2) Direkt zum Portfolio hinzufügen
      const linkFd = new FormData();
      linkFd.set("portfolio_id", portfolioId);
      linkFd.set("property_id", result.propertyId);
      const linkRes = await addPropertyToPortfolio(undefined, linkFd);
      if (linkRes?.error) {
        // Property ist angelegt, Link ist gescheitert — User bekommt eine
        // klare Meldung statt stiller Verwerfung.
        setError(linkRes.error);
        return;
      }

      onClose();
      router.refresh();
    });
  }

  return (
    <Modal open={open} onClose={pending ? () => {} : onClose} size="md">
      <ModalHeader
        title={t("portfolios.inline_create_title")}
        subtitle={t("portfolios.inline_create_subtitle")}
        onClose={pending ? undefined : onClose}
      />
      <form action={onSubmit}>
        <ModalBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field id="ip-kind" label={t("properties.kind")} required>
              <select
                id="ip-kind"
                name="kind"
                defaultValue="apartment"
                className={inputClass}
                required
              >
                <option value="apartment">{t("properties.kind_apartment")}</option>
                <option value="house">{t("properties.kind_house")}</option>
                <option value="parking">{t("properties.kind_parking")}</option>
                <option value="commercial">
                  {t("properties.kind_commercial")}
                </option>
                <option value="other">{t("properties.kind_other")}</option>
              </select>
            </Field>

            <Field id="ip-unit" label={t("properties.unit_number")}>
              <input
                id="ip-unit"
                name="unit_number"
                type="text"
                className={inputClass}
              />
            </Field>

            <Field id="ip-street" label={t("properties.street")} required>
              <input
                id="ip-street"
                name="street"
                type="text"
                required
                className={inputClass}
              />
            </Field>

            <Field id="ip-location" label={t("properties.location_detail")}>
              <input
                id="ip-location"
                name="location_detail"
                type="text"
                placeholder={t("properties.location_detail_hint")}
                className={inputClass}
              />
            </Field>

            <Field id="ip-postal" label={t("properties.postal_code")} required>
              <input
                id="ip-postal"
                name="postal_code"
                type="text"
                required
                className={inputClass}
              />
            </Field>

            <Field id="ip-city" label={t("properties.city")} required>
              <input
                id="ip-city"
                name="city"
                type="text"
                required
                className={inputClass}
              />
            </Field>
          </div>

          <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400">
            {t("portfolios.inline_create_hint")}
          </p>

          {error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {humanizeError(error, t)}
            </p>
          )}
        </ModalBody>

        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {pending ? t("common.loading") : t("common.create")}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

function humanizeError(
  raw: string,
  t: ReturnType<typeof useTranslations>
): string {
  // Premium-Errors haben ein eigenes UX im normalen create-Flow. Hier
  // im Inline-Modal verlinken wir nur freundlich zur Abrechnung.
  if (raw.startsWith("premium_choice_needed")) {
    return t("portfolios.inline_create_error_premium");
  }
  if (raw.startsWith("quantity_upgrade_needed")) {
    return t("portfolios.inline_create_error_quantity");
  }
  return raw;
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent";

function Field({
  id,
  label,
  required,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium block mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
