import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit } from "@/lib/workspace";
import { formatPropertyAddress } from "@/lib/properties";
import { readTenantScoreWeights } from "@/lib/calculations/tenant";
import {
  TenantForm,
  EMPTY_TENANT_DEFAULTS,
  type TenantDefaults,
} from "./tenant-form";
import { deleteTenant } from "./actions";

export default async function PropertyTenantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const [{ data: property }, { data: tenant }, { data: settings }] =
    await Promise.all([
      supabase
        .from("properties")
        .select("id, street, postal_code, city, location_detail, description")
        .eq("id", id)
        .maybeSingle(),
      supabase.from("tenants").select("*").eq("property_id", id).maybeSingle(),
      supabase
        .from("settings")
        .select("tenant_score_weights")
        .eq("workspace_id", active.id)
        .maybeSingle(),
    ]);

  const weights = readTenantScoreWeights(settings?.tenant_score_weights);

  if (!property) notFound();

  const readOnly = !canEdit(active.role);
  const defaults: TenantDefaults = tenant
    ? {
        name: tenant.name,
        contract_start: tenant.contract_start ?? "",
        family_status: tenant.family_status?.toString() ?? "",
        schufa: tenant.schufa?.toString() ?? "",
        rental_duration: tenant.rental_duration?.toString() ?? "",
        personal_impression: tenant.personal_impression?.toString() ?? "",
        employment_status: tenant.employment_status?.toString() ?? "",
        income_level: tenant.income_level?.toString() ?? "",
        notes: tenant.notes ?? "",
      }
    : EMPTY_TENANT_DEFAULTS;

  return (
    <div>
      <Link
        href={`/objekte/${id}`}
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {formatPropertyAddress(property)}
      </Link>
      <div className="mt-2 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("tenants.title")}
        </h1>
        {tenant && !readOnly && (
          <form action={deleteTenant.bind(null, id)}>
            <button
              type="submit"
              className="text-sm text-red-600 dark:text-red-400 hover:underline"
            >
              {t("tenants.delete_tenant")}
            </button>
          </form>
        )}
      </div>

      <div className="mt-6">
        <TenantForm
          propertyId={id}
          defaults={defaults}
          weights={weights}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}
