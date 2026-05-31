import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getActiveWorkspace, canEdit } from "@/lib/workspace";
import { PortfolioForm } from "../portfolio-form";

export default async function NewPortfolioPage() {
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;
  if (!canEdit(active.role)) redirect("/portfolios");

  return (
    <div>
      <Link
        href="/portfolios"
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {t("portfolios.title")}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {t("portfolios.new")}
      </h1>

      <div className="mt-6">
        <PortfolioForm defaults={{ name: "", description: "" }} />
      </div>
    </div>
  );
}
