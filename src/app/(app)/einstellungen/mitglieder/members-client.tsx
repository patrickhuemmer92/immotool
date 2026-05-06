"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { inviteMember, revokeMember, type InviteResult } from "./actions";

type MemberRow = {
  id: string;
  invited_email: string;
  role: "owner" | "editor" | "viewer";
  status: "pending" | "accepted" | "revoked";
  invited_at: string;
  invite_token: string | null;
};

type Labels = {
  invite: string;
  email: string;
  role: string;
  status: string;
  invited_at: string;
  revoke: string;
  invite_link: string;
  copy_link: string;
  link_copied: string;
  actions: string;
  empty: string;
  role_owner: string;
  role_editor: string;
  role_viewer: string;
  status_pending: string;
  status_accepted: string;
  status_revoked: string;
};

export function MembersClient({
  members,
  isOwner,
  labels,
}: {
  members: MemberRow[];
  isOwner: boolean;
  labels: Labels;
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<InviteResult, FormData>(
    inviteMember,
    undefined
  );

  return (
    <div className="space-y-10">
      {isOwner && (
        <section>
          <h2 className="text-base font-medium mb-3">{labels.invite}</h2>
          <form action={action} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[16rem]">
              <label className="text-sm font-medium block mb-1">
                {labels.email}
              </label>
              <input
                name="email"
                type="email"
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">
                {labels.role}
              </label>
              <select name="role" defaultValue="viewer" className={inputClass}>
                <option value="owner">{labels.role_owner}</option>
                <option value="editor">{labels.role_editor}</option>
                <option value="viewer">{labels.role_viewer}</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {pending ? t("common.loading") : t("common.create")}
            </button>
          </form>

          {state && "error" in state && state.error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {state.error}
            </p>
          )}
          {state && "success" in state && state.success && (
            <InviteSuccess token={state.token} labels={labels} />
          )}
        </section>
      )}

      <section>
        <h2 className="text-base font-medium mb-3">
          {t("settings.members")}
        </h2>
        {members.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {labels.empty}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr className="text-left">
                  <Th>{labels.email}</Th>
                  <Th>{labels.role}</Th>
                  <Th>{labels.status}</Th>
                  <Th>{labels.invited_at}</Th>
                  {isOwner && <Th>{labels.actions}</Th>}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr
                    key={m.id}
                    className="border-t border-neutral-200 dark:border-neutral-800"
                  >
                    <Td>{m.invited_email}</Td>
                    <Td>
                      {m.role === "owner"
                        ? labels.role_owner
                        : m.role === "editor"
                          ? labels.role_editor
                          : labels.role_viewer}
                    </Td>
                    <Td>
                      <StatusBadge status={m.status} labels={labels} />
                    </Td>
                    <Td>
                      {new Date(m.invited_at).toLocaleDateString()}
                    </Td>
                    {isOwner && (
                      <Td>
                        {m.status === "pending" && m.invite_token && (
                          <CopyButton
                            token={m.invite_token}
                            labels={labels}
                          />
                        )}
                        {m.status !== "revoked" && m.role !== "owner" && (
                          <button
                            onClick={() => revokeMember(m.id)}
                            className="ml-2 text-sm text-red-600 dark:text-red-400 hover:underline"
                          >
                            {labels.revoke}
                          </button>
                        )}
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function InviteSuccess({
  token,
  labels,
}: {
  token: string;
  labels: Labels;
}) {
  return (
    <div className="mt-4 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950 p-4 text-sm">
      <div className="font-medium mb-1">{labels.invite_link}</div>
      <CopyButton token={token} labels={labels} />
    </div>
  );
}

function CopyButton({ token, labels }: { token: string; labels: Labels }) {
  const [copied, setCopied] = useState(false);
  function buildUrl() {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/invite/${token}`;
  }
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(buildUrl());
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* ignore */
        }
      }}
      className="text-sm text-neutral-700 dark:text-neutral-300 underline-offset-2 hover:underline"
    >
      {copied ? labels.link_copied : labels.copy_link}
    </button>
  );
}

function StatusBadge({
  status,
  labels,
}: {
  status: MemberRow["status"];
  labels: Labels;
}) {
  const map: Record<MemberRow["status"], { txt: string; cls: string }> = {
    pending: {
      txt: labels.status_pending,
      cls: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    },
    accepted: {
      txt: labels.status_accepted,
      cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
    },
    revoked: {
      txt: labels.status_revoked,
      cls: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
    },
  };
  const v = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${v.cls}`}
    >
      {v.txt}
    </span>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100";

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2 align-middle">{children}</td>;
}
