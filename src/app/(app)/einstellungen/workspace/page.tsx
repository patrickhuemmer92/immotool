import { redirect } from "next/navigation";

/**
 * The Workspace settings tab has been removed from the UI per product
 * decision (workspaces are managed centrally). Any old bookmark or
 * deep-link redirects to the general settings page.
 */
export default async function WorkspaceSettingsPage() {
  redirect("/einstellungen");
}
