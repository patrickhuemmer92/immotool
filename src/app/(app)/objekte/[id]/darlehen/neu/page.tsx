import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getActiveWorkspace, canEdit } from "@/lib/workspace";
import { LoanForm, EMPTY_LOAN_DEFAULTS } from "../loan-form";

export default async function NewLoanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;
  if (!canEdit(active.role)) redirect(`/objekte/${id}/darlehen`);

  return (
    <div>
      <Link
        href={`/objekte/${id}/darlehen`}
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {t("loans.title")}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {t("loans.new")}
      </h1>
      <div className="mt-6">
        <LoanForm
          propertyId={id}
          defaults={EMPTY_LOAN_DEFAULTS}
          readOnly={false}
        />
      </div>
    </div>
  );
}
