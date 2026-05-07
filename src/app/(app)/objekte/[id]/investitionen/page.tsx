import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit } from "@/lib/workspace";
import { formatPropertyAddress } from "@/lib/properties";
import { InvestmentForm } from "./investment-form";
import { DeleteInvestmentButton } from "./delete-button";

type MeasureType =
  | "fixed_individual"
  | "optional_individual"
  | "fixed_common_reserve"
  | "fixed_common_levy"
  | "optional_common_reserve"
  | "optional_common_levy";

export default async function PropertyInvestmentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const [{ data: property }, { data: investments }] = await Promise.all([
    supabase
      .from("properties")
      .select("id, street, postal_code, city, location_detail, description")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("investment_plans")
      .select("id, year, is_long_term, amount, description, measure_type")
      .eq("property_id", id)
      .order("is_long_term")
      .order("year"),
  ]);

  if (!property) notFound();
  const editable = canEdit(active.role);

  return (
    <div>
      <Link
        href={`/objekte/${id}`}
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {formatPropertyAddress(property)}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {t("investments.title")}
      </h1>

      <div className="mt-6">
        {(investments ?? []).length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("investments.no_investments")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr className="text-left">
                  <Th>{t("investments.year")}</Th>
                  <Th>{t("investments.amount")}</Th>
                  <Th>{t("investments.measure_type")}</Th>
                  <Th>{t("investments.description")}</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {(investments ?? []).map((i) => (
                  <tr
                    key={i.id}
                    className="border-t border-neutral-200 dark:border-neutral-800"
                  >
                    <Td>
                      {i.is_long_term
                        ? t("investments.heatmap_long_term_label")
                        : i.year}
                    </Td>
                    <Td className="tabular-nums">
                      {Number(i.amount).toLocaleString(undefined, {
                        style: "currency",
                        currency: "EUR",
                        maximumFractionDigits: 0,
                      })}
                    </Td>
                    <Td>{t(`investments.type_${i.measure_type as MeasureType}`)}</Td>
                    <Td>{i.description ?? "—"}</Td>
                    <Td>
                      {editable && (
                        <DeleteInvestmentButton id={i.id} propertyId={id} />
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editable && (
        <div className="mt-8 max-w-3xl">
          <h2 className="text-lg font-semibold mb-4">{t("investments.new")}</h2>
          <InvestmentForm propertyId={id} />
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
      {children}
    </th>
  );
}
function Td({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2 align-middle ${className ?? ""}`}>{children}</td>;
}
