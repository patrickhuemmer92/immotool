"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ImageActionState = { error?: string } | undefined;

const CATEGORIES = [
  "exterior",
  "living_room",
  "bathroom",
  "kitchen",
  "bedroom",
  "other",
] as const;

const insertSchema = z.object({
  property_id: z.string().uuid(),
  storage_path: z.string().min(1),
  category: z.enum(CATEGORIES),
  caption: z.string().optional().transform((v) => (v && v.length ? v : null)),
});

export async function insertPropertyImage(input: {
  property_id: string;
  storage_path: string;
  category: string;
  caption?: string;
}): Promise<ImageActionState> {
  const parsed = insertSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();

  const { count } = await supabase
    .from("property_images")
    .select("id", { count: "exact", head: true })
    .eq("property_id", parsed.data.property_id);

  const { error } = await supabase.from("property_images").insert({
    property_id: parsed.data.property_id,
    storage_path: parsed.data.storage_path,
    category: parsed.data.category,
    caption: parsed.data.caption,
    display_order: count ?? 0,
  });

  if (error) return { error: error.message };

  revalidatePath(`/objekte/${parsed.data.property_id}/bilder`);
  return undefined;
}

export async function deletePropertyImage(
  imageId: string,
  propertyId: string
): Promise<ImageActionState> {
  const supabase = await createClient();
  const { data: img, error: fetchErr } = await supabase
    .from("property_images")
    .select("storage_path")
    .eq("id", imageId)
    .maybeSingle();

  if (fetchErr || !img) return { error: fetchErr?.message ?? "not_found" };

  await supabase.storage.from("property-images").remove([img.storage_path]);
  const { error } = await supabase
    .from("property_images")
    .delete()
    .eq("id", imageId);

  if (error) return { error: error.message };

  revalidatePath(`/objekte/${propertyId}/bilder`);
  return undefined;
}
