"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { eurExact } from "@/lib/format";
import { requalifyAnschaffungsnaheHK } from "./actions";

export type AnschaffungsnahStatus =
  | { state: "no_transfer_date" }
  | { state: "no_basis" }
  | {
      state: "ok" | "warn" | "exceeded";
      threshold: number;
      current: number;
      windowFrom: number;
      windowTo: number;
    };

export function AnschaffungsnahWarner({
  status,
  propertyId,
  transferYear,
  canEdit,
}: {
  status: AnschaffungsnahStatus;
  propertyId: string;
  transferYear: number | null;
  canEdit: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (status.state === "no_transfer_date") {
    return (
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 p-4 text-sm text-neutral-600 dark:text-neutral-400">
        {t("investments.anschaffungsnah_no_transfer_date")}
      </div>
    );
  }
  if (status.state === "no_basis") {
    return (
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 p-4 text-sm text-neutral-600 dark:text-neutral-400">
        {t("investments.anschaffungsnah_no_basis")}
      </div>
    );
  }

  const palette =
    status.state === "exceeded"
      ? "border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200"
      : status.state === "warn"
        ? "border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200"
        : "border-emerald-300 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200";

  function handleRequalify() {
    if (transferYear == null) return;
    if (!confirm(t("investments.anschaffungsnah_requalify_cta") + "?")) return;
    startTransition(async () => {
      await requalifyAnschaffungsnaheHK(propertyId, transferYear);
      router.refresh();
    });
  }

  return (
    <div className={`rounded-xl border ${palette} p-4 text-sm space-y-3`}>
      <div className="font-semibold">
        {t("investments.anschaffungsnah_warn_title")}
      </div>
      <p className="text-[12px] leading-snug opacity-90">
        {t("investments.anschaffungsnah_warn_body")}
      </p>
      <dl className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px]">
        <div>
          <dt className="opacity-70">
            {t("investments.anschaffungsnah_threshold")}
          </dt>
          <dd className="font-semibold tabular-nums">
            {eurExact(status.threshold)}
          </dd>
        </div>
        <div>
          <dt className="opacity-70">
            {t("investments.anschaffungsnah_current")}
          </dt>
          <dd className="font-semibold tabular-nums">
            {eurExact(status.current)}
          </dd>
        </div>
        <div>
          <dt className="opacity-70">
            {t("investments.anschaffungsnah_window")}
          </dt>
          <dd className="font-semibold tabular-nums">
            {status.windowFrom} – {status.windowTo}
          </dd>
        </div>
      </dl>
      <p className="text-[12px] font-medium">
        {status.state === "exceeded"
          ? t("investments.anschaffungsnah_status_exceeded")
          : status.state === "warn"
            ? t("investments.anschaffungsnah_status_warn")
            : t("investments.anschaffungsnah_status_ok")}
      </p>
      {status.state === "exceeded" && canEdit && (
        <button
          type="button"
          disabled={pending}
          onClick={handleRequalify}
          className="rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
        >
          {t("investments.anschaffungsnah_requalify_cta")}
        </button>
      )}
    </div>
  );
}
