"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { deleteDdProject } from "./actions";

/**
 * Kleiner Löschen-Button für die Karten in der /analyse-Liste.
 * Bewusst als Client-Component (Confirm-Dialog + optimistisches UI-
 * Verhalten), aber ruft die Server-Action deleteDdProject direkt auf.
 *
 * Beim Klick: `stopPropagation`, damit der umschließende <Link> zur
 * Detail-Seite nicht mit-triggert. Ohne das würde beim Delete-Klick
 * gleichzeitig auf die soeben gelöschte Seite navigiert.
 */
export function DdDeleteButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (
      !confirm(t("dd.delete_confirm", { name: projectName }))
    ) {
      return;
    }
    setError(null);
    start(async () => {
      try {
        await deleteDdProject(projectId);
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
