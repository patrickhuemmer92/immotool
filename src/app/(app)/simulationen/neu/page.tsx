import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit } from "@/lib/workspace";
import { formatPropertyAddress } from "@/lib/properties";
import { SimulationForm } from "../simulation-form";

export default async function NewSimulationPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;
  if (!canEdit(active.role)) redirect("/simulationen");

  const { propertyId } = await searchParams;

  const supabase = await createClient();
  const { data: properties } = await supabase
    .from("properties")
    .select("id, street, postal_code, city, location_detail, description")
    .eq("workspace_id", active.id)
    .order("city")
    .order("street");

  const options = (properties ?? []).map((p) => ({
    id: p.id,
    label: formatPropertyAddress(p),
  }));

  return (
    <div>
      <Link
        href="/simulationen"
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {t("simulations.title")}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {t("simulations.new")}
      </h1>

      <div className="mt-6">
        <SimulationForm
          properties={options}
          defaults={{
            property_id: propertyId ?? "",
            name: "",
            description: "",
            rent_growth_pa: "",
            cost_growth_pa: "",
            interest_change_bps: "",
          }}
        />
      </div>
    </div>
  );
}
