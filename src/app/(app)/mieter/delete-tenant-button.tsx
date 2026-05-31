"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { deleteTenant } from "../objekte/[id]/mieter/actions";

export function DeleteTenantButton({ propertyId }: { propertyId: string }) {
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
          await deleteTenant(propertyId);
          router.refresh();
        });
      }}
      className="text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
    >
      {t("common.delete")}
    </button>
  );
}
