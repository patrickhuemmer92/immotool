"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/modal";
import { createTenant } from "./mieter/actions";

/**
 * "+ Mieter" auf der Property-Detail-Seite. Spart den Sprung in
 * /objekte/[id]/mieter und zurück.
 *
 * Bewusst Minimal-Felder: Name, Kaltmiete, Nebenkosten, optional
 * Mietbeginn + Vertragsart. Notizen / Score / Faktoren trägt der
 * User später in der vollen Mieter-Seite nach.
 */
export function InlineTenantButton({ propertyId }: { propertyId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFixed, setIsFixed] = useState(false);
  const [pending, start] = useTransition();

  function onSubmit(fd: FormData) {
    setError(null);
    start(async () => {
      const result = await createTenant(propertyId, undefined, fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"
      >
        + {t("tenants.title")}
      </button>

      <Modal open={open} onClose={pending ? () => {} : () => setOpen(false)}>
        <ModalHeader
          title={t("tenants.inline_create_title")}
          subtitle={t("tenants.inline_create_subtitle")}
          onClose={pending ? undefined : () => setOpen(false)}
        />
        <form action={onSubmit}>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field id="it-name" label={t("tenants.name")} required>
                <input
                  id="it-name"
                  name="name"
                  type="text"
                  required
                  className={inputClass}
                />
              </Field>
              <Field id="it-start" label={t("tenants.contract_start")}>
                <input
                  id="it-start"
                  name="contract_start"
                  type="date"
                  className={inputClass}
                />
              </Field>
              <Field id="it-cold" label={t("tenants.cold_rent_per_month")} required>
                <input
                  id="it-cold"
                  name="cold_rent_per_month"
                  type="text"
                  inputMode="decimal"
                  required
                  className={inputClass}
                />
              </Field>
              <Field
                id="it-anc"
                label={t("tenants.ancillary_costs_per_month")}
                required
              >
                <input
                  id="it-anc"
                  name="ancillary_costs_per_month"
                  type="text"
                  inputMode="decimal"
                  required
                  defaultValue="0"
                  className={inputClass}
                />
              </Field>

              <Field id="it-term-type" label={t("tenants.term_type")}>
                <select
                  id="it-term-type"
                  name="is_fixed_term"
                  value={isFixed ? "true" : ""}
                  onChange={(e) => setIsFixed(e.target.value === "true")}
                  className={inputClass}
                >
                  <option value="">{t("tenants.term_open_ended")}</option>
                  <option value="true">{t("tenants.term_fixed")}</option>
                </select>
              </Field>
              {isFixed && (
                <Field id="it-end" label={t("tenants.contract_end")} required>
                  <input
                    id="it-end"
                    name="contract_end"
                    type="date"
                    required
                    className={inputClass}
                  />
                </Field>
              )}
            </div>

            <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400">
              {t("tenants.inline_create_hint")}
            </p>

            {error && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
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
    </>
  );
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
