import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit } from "@/lib/workspace";
import { formatPropertyAddress } from "@/lib/properties";

export default async function PropertyLoansPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const [{ data: property }, { data: loans }] = await Promise.all([
    supabase
      .from("properties")
      .select("id, street, postal_code, city, location_detail, description")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("loans")
      .select(
        "id, designation, bank, loan_amount, interest_rate_pa, amortization_pa, first_payment_date"
      )
      .eq("property_id", id)
      .order("first_payment_date"),
  ]);

  if (!property) notFound();

  return (
    <div>
      <Link
        href={`/objekte/${id}`}
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {formatPropertyAddress(property)}
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("loans.title")}
        </h1>
        {canEdit(active.role) && (
          <Link
            href={`/objekte/${id}/darlehen/neu`}
            className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            + {t("loans.new")}
          </Link>
        )}
      </div>

      <div className="mt-6">
        {!loans || loans.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("loans.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr className="text-left">
                  <Th>{t("loans.designation")}</Th>
                  <Th>{t("loans.bank")}</Th>
                  <Th>{t("loans.loan_amount")}</Th>
                  <Th>{t("loans.interest_rate_pa")}</Th>
                  <Th>{t("loans.amortization_pa")}</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => (
                  <tr
                    key={l.id}
                    className="border-t border-neutral-200 dark:border-neutral-800"
                  >
                    <Td>
                      <Link
                        href={`/objekte/${id}/darlehen/${l.id}`}
                        className="font-medium hover:underline"
                      >
                        {l.designation}
                      </Link>
                    </Td>
                    <Td>{l.bank ?? "—"}</Td>
                    <Td>{formatCurrency(l.loan_amount)}</Td>
                    <Td>{formatPct(l.interest_rate_pa)}</Td>
                    <Td>{formatPct(l.amortization_pa)}</Td>
                    <Td>
                      <Link
                        href={`/objekte/${id}/darlehen/${l.id}`}
                        className="text-sm hover:underline"
                      >
                        {t("common.edit")} →
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function formatCurrency(v: string | number | null): string {
  if (v === null) return "—";
  const n = typeof v === "number" ? v : Number(v);
  return n.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function formatPct(v: string | number | null): string {
  if (v === null) return "—";
  const n = typeof v === "number" ? v : Number(v);
  return (n * 100).toLocaleString("de-DE", { maximumFractionDigits: 4 }) + " %";
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2 align-middle">{children}</td>;
}
