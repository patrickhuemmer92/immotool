"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { deleteInvestment } from "./actions";

export function DeleteInvestmentButton({
  id,
  propertyId,
}: {
  id: string;
  propertyId: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(t("common.confirm_delete"))) return;
        start(async () => {
          await deleteInvestment(id, propertyId);
          router.refresh();
        });
      }}
      className="text-xs text-red-600 dark:text-red-400 hover:underline"
    >
      ×
    </button>
  );
}
