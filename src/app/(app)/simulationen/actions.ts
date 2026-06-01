"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { parseDecimal } from "@/lib/format";

export type SimulationFormState = { error?: string } | undefined;

// --- Schemas ---------------------------------------------------------

/** Prozentwert vom User (z. B. "2,5") → Dezimalbruch 0.025. */
const percentInput = z
  .string()
  .optional()
  .superRefine((v, ctx) => {
    if (!v || !v.length) return;
    const n = parseDecimal(v);
    if (n === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `invalid_percent:${v}`,
      });
    }
  })
  .transform((v) => {
    if (!v || !v.length) return 0;
    const n = parseDecimal(v);
    return n == null ? 0 : n / 100;
  });

/** Basispunkte vom User ("200" oder "-150") → integer. */
const bpsInput = z
  .string()
  .optional()
  .transform((v) => {
    if (!v || !v.length) return 0;
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? Math.round(n) : 0;
  });

const simulationSchema = z.object({
  property_id: z.string().uuid("invalid_property"),
  name: z.string().trim().min(1, "name_required").max(200),
  description: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length ? v.trim() : null)),
  rent_growth_pa: percentInput,
  cost_growth_pa: percentInput,
  interest_change_bps: bpsInput,
});

function readForm(formData: FormData) {
  return {
    property_id: String(formData.get("property_id") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: (formData.get("description") as string | null) ?? undefined,
    rent_growth_pa: (formData.get("rent_growth_pa") as string | null) ?? undefined,
    cost_growth_pa: (formData.get("cost_growth_pa") as string | null) ?? undefined,
    interest_change_bps:
      (formData.get("interest_change_bps") as string | null) ?? undefined,
  };
}

// --- CRUD: Simulation -----------------------------------------------

export async function createSimulation(
  _prev: SimulationFormState,
  formData: FormData
): Promise<SimulationFormState> {
  const active = await getActiveWorkspace();
  if (!active) return { error: "no_workspace" };

  const parsed = simulationSchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("simulations")
    .insert({ ...parsed.data, workspace_id: active.id })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505" || error.message.includes("duplicate")) {
      return { error: "duplicate_simulation_name" };
    }
    console.error("[simulations:create]", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return { error: error.message };
  }

  revalidatePath("/simulationen");
  redirect(`/simulationen/${data.id}`);
}

export async function updateSimulation(
  simulationId: string,
  _prev: SimulationFormState,
  formData: FormData
): Promise<SimulationFormState> {
  const parsed = simulationSchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("simulations")
    .update(parsed.data)
    .eq("id", simulationId);

  if (error) {
    if (error.code === "23505" || error.message.includes("duplicate")) {
      return { error: "duplicate_simulation_name" };
    }
    return { error: error.message };
  }

  revalidatePath("/simulationen");
  revalidatePath(`/simulationen/${simulationId}`);
  return undefined;
}

export async function deleteSimulation(simulationId: string) {
  const supabase = await createClient();
  await supabase.from("simulations").delete().eq("id", simulationId);
  revalidatePath("/simulationen");
  redirect("/simulationen");
}

// --- Membership: zusätzliche Investitionen --------------------------

const investmentNumber = z
  .string()
  .superRefine((v, ctx) => {
    if (!v || !v.length || parseDecimal(v) === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `invalid_number:${v ?? ""}`,
      });
    }
  })
  .transform((v) => parseDecimal(v) as number);

const investmentSchema = z.object({
  simulation_id: z.string().uuid(),
  year: z
    .string()
    .min(1)
    .transform((v) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.round(n) : NaN;
    })
    .refine((n) => Number.isFinite(n) && n >= 1900 && n <= 2200, {
      message: "invalid_year",
    }),
  amount: investmentNumber,
  description: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length ? v.trim() : null)),
  tax_treatment: z.enum([
    "expense_immediate",
    "expense_82b",
    "capitalized_building",
    "capitalized_separate",
    "non_deductible",
  ]),
  expense_82b_years: z
    .string()
    .optional()
    .transform((v) => {
      if (!v || !v.length) return null;
      const n = Number(v);
      return Number.isFinite(n) && n >= 2 && n <= 5 ? n : null;
    }),
  useful_life_years: z
    .string()
    .optional()
    .transform((v) => {
      if (!v || !v.length) return null;
      const n = Number(v);
      return Number.isFinite(n) && n >= 1 && n <= 100 ? n : null;
    }),
});

export async function addSimulationInvestment(
  _prev: SimulationFormState,
  formData: FormData
): Promise<SimulationFormState> {
  const parsed = investmentSchema.safeParse({
    simulation_id: formData.get("simulation_id"),
    year: formData.get("year"),
    amount: formData.get("amount"),
    description: formData.get("description") ?? undefined,
    tax_treatment: formData.get("tax_treatment"),
    expense_82b_years: formData.get("expense_82b_years") ?? undefined,
    useful_life_years: formData.get("useful_life_years") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("simulation_investments")
    .insert(parsed.data);

  if (error) {
    console.error("[simulations:addInvestment]", error);
    return { error: error.message };
  }

  revalidatePath(`/simulationen/${parsed.data.simulation_id}`);
  return undefined;
}

export async function removeSimulationInvestment(
  investmentId: string,
  simulationId: string
) {
  const supabase = await createClient();
  await supabase
    .from("simulation_investments")
    .delete()
    .eq("id", investmentId);
  revalidatePath(`/simulationen/${simulationId}`);
}
