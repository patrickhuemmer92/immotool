import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function ReferralPage() {
  const t = await getTranslations();
  const subject = encodeURIComponent(t("referral.share_subject"));
  const body = encodeURIComponent(t("referral.share_body"));
  const mailto = `mailto:?subject=${subject}&body=${body}`;

  return (
    <div className="max-w-2xl">
      <Link
        href="/einstellungen"
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {t("settings.title")}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {t("referral.title")}
      </h1>

      <div className="mt-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
        <div className="flex items-start gap-4">
          <span
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent-foreground border border-accent/30 shrink-0"
            aria-hidden
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="8" width="18" height="4" rx="1" />
              <path d="M12 8v13" />
              <path d="M4 12v9h16v-9" />
              <path d="M7.5 8a2.5 2.5 0 1 1 0-5C9 3 12 8 12 8" />
              <path d="M16.5 8a2.5 2.5 0 1 0 0-5C15 3 12 8 12 8" />
            </svg>
          </span>
          <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
            {t("referral.lead")}
          </p>
        </div>

        <div className="mt-6 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
          <div className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            {t("referral.share_link_label")}
          </div>
          <a
            href={mailto}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-accent text-accent-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 7l9 7 9-7" />
            </svg>
            {t("referral.share_link_cta")}
          </a>
        </div>

        <p className="mt-4 text-[11px] text-neutral-500 dark:text-neutral-400">
          {t("referral.coming_soon")}
        </p>
      </div>
    </div>
  );
}
