"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { deleteProperty } from "../actions";

/**
 * "Objekt löschen"-Button mit Confirm-Modal.
 *
 * Ersetzt das einfache `<form action={deleteProperty.bind(...)}>`-Submit
 * durch einen zweistufigen Flow: erst Button klicken → Modal mit
 * Warnung + Bestätigung → erst dann tatsächliche Server-Action.
 *
 * Wir nehmen ein eigenes Modal statt window.confirm(), damit die
 * Optik zum Rest der App passt (siehe ModalShell in property-form.tsx).
 */
export function DeletePropertyButton({
  propertyId,
  propertyAddress,
}: {
  propertyId: string;
  /** Wird im Modal angezeigt, damit der User sieht, was er löscht. */
  propertyAddress: string;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function onConfirm() {
    start(async () => {
      // Server-Action — beinhaltet redirect("/objekte"), daher kein
      // weiterer Client-Code nötig.
      await deleteProperty(propertyId);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-red-600 dark:text-red-400 hover:underline px-2"
      >
        {t("common.delete")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 max-w-md w-full shadow-xl"
          >
            <h3 className="text-lg font-semibold">
              {t("properties.delete_confirm_title")}
            </h3>
            <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
              {t("properties.delete_confirm_intro", {
                address: propertyAddress,
              })}
            </p>
            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              {t("properties.delete_confirm_warning")}
            </p>
            <div className="mt-5 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={pending}
                className="rounded-lg bg-red-600 text-white px-3 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {pending
                  ? t("common.loading")
                  : t("properties.delete_confirm_action")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
