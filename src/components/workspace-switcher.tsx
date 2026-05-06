"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { switchWorkspace } from "@/app/(app)/workspace-actions";
import type { ActiveWorkspace } from "@/lib/workspace";

export function WorkspaceSwitcher({
  workspaces,
  active,
}: {
  workspaces: ActiveWorkspace[];
  active: ActiveWorkspace;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (workspaces.length <= 1) {
    return (
      <div className="text-sm font-medium truncate" title={active.name}>
        {active.name}
      </div>
    );
  }

  return (
    <select
      defaultValue={active.id}
      onChange={(e) => {
        const id = e.target.value;
        startTransition(async () => {
          await switchWorkspace(id);
          router.refresh();
        });
      }}
      disabled={pending}
      className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1 text-sm max-w-[14rem]"
      aria-label="Workspace"
    >
      {workspaces.map((w) => (
        <option key={w.id} value={w.id}>
          {w.name}
        </option>
      ))}
    </select>
  );
}
