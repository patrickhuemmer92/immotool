import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit } from "@/lib/workspace";
import { PropertyForm } from "../property-form";
import {
  EMPTY_PROPERTY_DEFAULTS,
  formatPropertyAddress,
} from "@/lib/properties";

export default async function NewPropertyPage() {
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;
  if (!canEdit(active.role)) redirect("/objekte");

  const supabase = await createClient();
  const [{ data: houses }, { data: owners }] = await Promise.all([
    supabase
      .from("properties")
      .select("id, street, postal_code, city, location_detail, description")
      .eq("workspace_id", active.id)
      .eq("kind", "house")
      .order("city")
      .order("street"),
    supabase
      .from("owners")
      .select("id, name")
      .eq("workspace_id", active.id)
      .order("name"),
  ]);

  const parentCandidates = (houses ?? []).map((h) => ({
    id: h.id,
    label: formatPropertyAddress(h),
  }));

  return (
    <div>
      <Link
        href="/objekte"
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {t("properties.title")}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {t("properties.new")}
      </h1>

      <div className="mt-6">
        <PropertyForm
          defaults={EMPTY_PROPERTY_DEFAULTS}
          parentCandidates={parentCandidates}
          availableOwners={owners ?? []}
          readOnly={false}
        />
      </div>
    </div>
  );
}
