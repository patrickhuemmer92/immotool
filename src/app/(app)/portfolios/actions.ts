"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";

export type PortfolioFormState = { error?: string } | undefined;

const portfolioSchema = z.object({
  name: z.string().trim().min(1, "name_required").max(200),
  description: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length ? v.trim() : null)),
});

function readForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    description: (formData.get("description") as string | null) ?? undefined,
  };
}

// =====================================================================
// CRUD: Portfolio
// =====================================================================
export async function createPortfolio(
  _prev: PortfolioFormState,
  formData: FormData
): Promise<PortfolioFormState> {
  const active = await getActiveWorkspace();
  if (!active) return { error: "no_workspace" };

  const parsed = portfolioSchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("portfolios")
    .insert({ ...parsed.data, workspace_id: active.id })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505" || error.message.includes("duplicate")) {
      return { error: "duplicate_portfolio_name" };
    }
    return { error: error.message };
  }

  revalidatePath("/portfolios");
  revalidatePath("/objekte");
  redirect(`/portfolios/${data.id}`);
}

export async function updatePortfolio(
  portfolioId: string,
  _prev: PortfolioFormState,
  formData: FormData
): Promise<PortfolioFormState> {
  const parsed = portfolioSchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("portfolios")
    .update(parsed.data)
    .eq("id", portfolioId);

  if (error) {
    if (error.code === "23505" || error.message.includes("duplicate")) {
      return { error: "duplicate_portfolio_name" };
    }
    return { error: error.message };
  }

  revalidatePath("/portfolios");
  revalidatePath(`/portfolios/${portfolioId}`);
  return undefined;
}

export async function deletePortfolio(portfolioId: string) {
  const supabase = await createClient();
  await supabase.from("portfolios").delete().eq("id", portfolioId);
  revalidatePath("/portfolios");
  revalidatePath("/objekte");
  redirect("/portfolios");
}

// =====================================================================
// Membership: Property zu Portfolio hinzufügen / entfernen
// =====================================================================

const togglePayloadSchema = z.object({
  portfolio_id: z.string().uuid(),
  property_id: z.string().uuid(),
});

export async function addPropertyToPortfolio(
  _prev: PortfolioFormState,
  formData: FormData
): Promise<PortfolioFormState> {
  const parsed = togglePayloadSchema.safeParse({
    portfolio_id: formData.get("portfolio_id"),
    property_id: formData.get("property_id"),
  });
  if (!parsed.success) return { error: "invalid_payload" };

  const supabase = await createClient();
  // Composite-PK verhindert Duplikate automatisch — fehlt sicherheitshalber
  // upsert mit on_conflict do nothing.
  const { error } = await supabase
    .from("portfolio_properties")
    .upsert(parsed.data, { onConflict: "portfolio_id,property_id" });

  if (error) {
    console.error("[portfolio:addProperty]", {
      message: error.message,
      details: error.details,
      code: error.code,
    });
    return { error: error.message };
  }

  revalidatePath(`/portfolios/${parsed.data.portfolio_id}`);
  revalidatePath("/portfolios");
  revalidatePath("/objekte");
  return undefined;
}

export async function removePropertyFromPortfolio(
  portfolioId: string,
  propertyId: string
) {
  const supabase = await createClient();
  await supabase
    .from("portfolio_properties")
    .delete()
    .eq("portfolio_id", portfolioId)
    .eq("property_id", propertyId);
  revalidatePath(`/portfolios/${portfolioId}`);
  revalidatePath("/portfolios");
  revalidatePath("/objekte");
}
