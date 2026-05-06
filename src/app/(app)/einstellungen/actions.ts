"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";

const settingsSchema = z.object({
  tax_rate: z.coerce.number().min(0).max(1),
  default_depreciation_rate: z.coerce.number().min(0).max(1),
  default_locale: z.enum(["de", "en"]),
  default_currency: z.string().min(3).max(3),
});

export type FormState = { error?: string; success?: boolean } | undefined;

export async function updateSettings(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const active = await getActiveWorkspace();
  if (!active) return { error: "no_workspace" };

  const parsed = settingsSchema.safeParse({
    tax_rate: formData.get("tax_rate"),
    default_depreciation_rate: formData.get("default_depreciation_rate"),
    default_locale: formData.get("default_locale"),
    default_currency: formData.get("default_currency"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update(parsed.data)
    .eq("workspace_id", active.id);

  if (error) return { error: error.message };

  revalidatePath("/einstellungen");
  return { success: true };
}

export async function updateWorkspaceName(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const active = await getActiveWorkspace();
  if (!active) return { error: "no_workspace" };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name darf nicht leer sein." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspaces")
    .update({ name })
    .eq("id", active.id);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: true };
}
