import { getActiveWorkspace } from "@/lib/workspace";
import { WorkspaceForm } from "./workspace-form";

export default async function WorkspaceSettingsPage() {
  const active = await getActiveWorkspace();
  if (!active) return null;

  return (
    <WorkspaceForm
      defaultName={active.name}
      readOnly={active.role !== "owner"}
    />
  );
}
