"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { deleteOnboardingProject } from "./actions";

/**
 * Löschen-Button für Onboarding-Karten in der /onboarding-Liste.
 * Bei Confirm: Server-Action räumt Docs + Storage + Projekt-Row weg.
 * Die evtl. bereits erstellte Property (nach Confirm) bleibt bestehen.
 */
export function OnbDeleteButton({
  projectId,
  projectName,
  hasProperty,
}: {
  projectId: string;
  projectName: string;
  hasProperty: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const confirmKey = hasProperty
      ? "onb.delete_confirm_with_property"
      : "onb.delete_confirm";
    if (!confirm(t(confirmKey, { name: projectName }))) return;

    setError(null);
    start(async () => {
      try {
        await deleteOnboardingProject(projectId, { redirectToList: false });
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
      title={t("common.delete")}
    >
      {pending ? "…" : t("common.delete")}
      {error && <span className="ml-2 text-red-500">({error})</span>}
    </button>
  );
}
