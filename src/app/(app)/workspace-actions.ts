"use server";

import { revalidatePath } from "next/cache";
import { setActiveWorkspaceCookie } from "@/lib/workspace";

export async function switchWorkspace(workspaceId: string) {
  await setActiveWorkspaceCookie(workspaceId);
  revalidatePath("/", "layout");
}
