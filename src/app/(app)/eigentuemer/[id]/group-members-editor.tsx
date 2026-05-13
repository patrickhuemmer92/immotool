"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { addGroupMember, removeGroupMember } from "../actions";

type Member = { id: string; person_owner_id: string; name: string };
type Candidate = { id: string; name: string };

export function GroupMembersEditor({
  groupId,
  members,
  availablePersons,
  readOnly,
}: {
  groupId: string;
  members: Member[];
  availablePersons: Candidate[];
  readOnly: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pick, setPick] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add() {
    if (!pick) return;
    setError(null);
    start(async () => {
      const res = await addGroupMember(groupId, pick);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setPick("");
      router.refresh();
    });
  }

  function remove(memberId: string) {
    if (!confirm(t("common.confirm_delete"))) return;
    start(async () => {
      await removeGroupMember(memberId, groupId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {members.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {t("owners.no_members")}
        </p>
      ) : (
        <ul className="space-y-1">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-md border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-sm"
            >
              <span>{m.name}</span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => remove(m.id)}
                  disabled={pending}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly &&
        (availablePersons.length === 0 ? (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t("owners.no_more_persons")}
          </p>
        ) : (
          <div className="flex gap-2 items-end pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <div className="flex-1">
              <label className="text-xs font-medium block mb-1">
                {t("owners.add_member")}
              </label>
              <select
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                disabled={pending}
                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
              >
                <option value="">{t("owners.select_person")}</option>
                {availablePersons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={add}
              disabled={pending || !pick}
              className="rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {t("owners.add_member_action")}
            </button>
          </div>
        ))}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
