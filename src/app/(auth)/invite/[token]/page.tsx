import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { acceptInvite } from "./actions";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = await getTranslations();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const { data: invite } = await supabase
    .from("workspace_members")
    .select("id, role, status, workspaces!inner(name)")
    .eq("invite_token", token)
    .maybeSingle();

  const workspace = invite?.workspaces as unknown as
    | { name: string }
    | undefined;

  if (!invite || invite.status !== "pending" || !workspace) {
    return (
      <Card>
        <h1 className="text-xl font-semibold">{t("invite.title")}</h1>
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          {t("invite.invalid_or_used")}
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold">{t("invite.title")}</h1>
      <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
        {t("invite.joining", {
          workspace: workspace.name,
          role: t(`settings.role_${invite.role}` as const),
        })}
      </p>
      <form action={acceptInvite.bind(null, token)} className="mt-6">
        <button
          type="submit"
          className="w-full rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-3 py-2 text-sm font-medium hover:opacity-90"
        >
          {t("invite.accept")}
        </button>
      </form>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8 shadow-sm">
      {children}
    </div>
  );
}
