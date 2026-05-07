"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type OwnerShareState = { error?: string; sum?: number } | undefined;

const shareItemSchema = z.object({
  owner_id: z.string().uuid("invalid_owner_id"),
  ownership_share: z
    .number()
    .gt(0, "share_range")
    .lte(1, "share_range"),
});

const payloadSchema = z.object({
  shares: z.array(shareItemSchema),
});

export async function setPropertyOwners(
  propertyId: string,
  _prev: OwnerShareState,
  formData: FormData
): Promise<OwnerShareState> {
  const raw = formData.get("payload");
  if (typeof raw !== "string") return { error: "missing_payload" };

  let parsed;
  try {
    const json = JSON.parse(raw);
    parsed = payloadSchema.safeParse(json);
  } catch {
    return { error: "invalid_json" };
  }
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const ids = new Set<string>();
  for (const s of parsed.data.shares) {
    if (ids.has(s.owner_id)) return { error: "duplicate_owner" };
    ids.add(s.owner_id);
  }

  const sum = parsed.data.shares.reduce(
    (acc, s) => acc + s.ownership_share,
    0
  );
  if (parsed.data.shares.length > 0 && Math.abs(sum - 1) > 0.0001) {
    return { error: "sum_not_one", sum };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_property_owners", {
    p_property_id: propertyId,
    p_shares: parsed.data.shares,
  });

  if (error) return { error: error.message };

  revalidatePath(`/objekte/${propertyId}`);
  revalidatePath(`/objekte/${propertyId}/bearbeiten`);
  return { sum };
}
