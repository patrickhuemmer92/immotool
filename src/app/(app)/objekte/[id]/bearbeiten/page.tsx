import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit } from "@/lib/workspace";
import {
  formatPropertyAddress,
  rowToDefaults,
  type PropertyRow,
} from "@/lib/properties";
import { PropertyForm } from "../../property-form";
import { OwnerShareEditor } from "../../owner-share-editor";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const [
    { data: property },
    { data: owners },
    { data: shares },
    { data: houses },
  ] = await Promise.all([
    supabase.from("properties").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("owners")
      .select("id, name")
      .eq("workspace_id", active.id)
      .order("name"),
    supabase
      .from("property_owners")
      .select("owner_id, ownership_share")
      .eq("property_id", id),
    supabase
      .from("properties")
      .select("id, street, postal_code, city, location_detail, description")
      .eq("workspace_id", active.id)
      .eq("kind", "house")
      .order("city")
      .order("street"),
  ]);

  if (!property) notFound();

  const readOnly = !canEdit(active.role);

  const parentCandidates = (houses ?? [])
    .filter((h) => h.id !== id)
    .map((h) => ({ id: h.id, label: formatPropertyAddress(h) }));

  return (
    <div>
      <Link
        href={`/objekte/${id}`}
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {t("properties.back")}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {t("properties.edit")}
      </h1>

      <div className="mt-6">
        <PropertyForm
          propertyId={id}
          defaults={rowToDefaults(property as PropertyRow)}
          parentCandidates={parentCandidates}
          readOnly={readOnly}
        />
      </div>

      <div className="mt-12 max-w-3xl">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
          {t("properties.section_owners")}
        </h2>
        <OwnerShareEditor
          propertyId={id}
          owners={owners ?? []}
          initial={
            (shares ?? []).map((s) => ({
              owner_id: s.owner_id,
              ownership_share:
                typeof s.ownership_share === "string"
                  ? Number(s.ownership_share)
                  : (s.ownership_share as number),
            }))
          }
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}
