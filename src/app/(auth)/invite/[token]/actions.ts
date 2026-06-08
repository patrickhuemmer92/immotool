"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setActiveWorkspaceCookie } from "@/lib/workspace";

export async function acceptInvite(token: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  const { data: invite, error } = await supabase
    .from("workspace_members")
    .update({
      user_id: user.id,
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .eq("invite_token", token)
    .eq("status", "pending")
    .select("workspace_id")
    .maybeSingle();

  if (error || !invite) {
    redirect("/login");
  }

  await setActiveWorkspaceCookie(invite.workspace_id);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
