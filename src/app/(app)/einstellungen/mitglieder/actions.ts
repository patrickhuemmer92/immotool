"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";

export type InviteResult =
  | { error: string }
  | { success: true; token: string }
  | undefined;

const schema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "editor", "viewer"]),
});

export async function inviteMember(
  _prev: InviteResult,
  formData: FormData
): Promise<InviteResult> {
  const active = await getActiveWorkspace();
  if (!active) return { error: "no_workspace" };
  if (active.role !== "owner") return { error: "Nur Owner können einladen." };

  const parsed = schema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const token = crypto.randomUUID();
  const supabase = await createClient();
  const { error } = await supabase.from("workspace_members").insert({
    workspace_id: active.id,
    invited_email: parsed.data.email,
    role: parsed.data.role,
    status: "pending",
    invite_token: token,
  });

  if (error) return { error: error.message };

  revalidatePath("/einstellungen/mitglieder");
  return { success: true, token };
}

export async function revokeMember(memberId: string) {
  const active = await getActiveWorkspace();
  if (!active) return;
  if (active.role !== "owner") return;

  const supabase = await createClient();
  await supabase
    .from("workspace_members")
    .update({ status: "revoked" })
    .eq("id", memberId)
    .eq("workspace_id", active.id);

  revalidatePath("/einstellungen/mitglieder");
}
