"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { logout } from "@/app/(auth)/auth-actions";

type Props = {
  email: string;
  /**
   * Tage bis Trial-Ende. null wenn nicht im Trial oder bereits zahlender
   * Premium-Account.
   */
  trialDaysRemaining: number | null;
  /** true wenn der User aktuell ein laufendes (zahlendes) Abo hat. */
  hasPaidSubscription: boolean;
  /** Tier-Badge im Menü ("Free" / "Premium"). */
  tierLabel: string;
  /** Whether the upgrade CTA should be visible (hide for paid Premium users). */
  showUpgradeCta: boolean;
};

export function TopbarAccount({
  email,
  trialDaysRemaining,
  hasPaidSubscription,
  tierLabel,
  showUpgradeCta,
}: Props) {
  const t = useTranslations("topbar");
  const [open, setOpen] = useState(false);
  const [portalPending, startPortal] = useTransition();
  const [portalError, setPortalError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click + Esc
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openPortal() {
    setPortalError(null);
    startPortal(async () => {
      try {
        const res = await fetch("/api/billing/portal", { method: "POST" });
        const json = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !json.url) {
          setPortalError(json.error ?? "unknown");
          return;
        }
        window.location.href = json.url;
      } catch {
        setPortalError("network");
      }
    });
  }

  // Initialen aus E-Mail-Präfix.
  const initial =
    email
      .split("@")[0]
      .split(/[._-]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "?";

  const trialBadge = (() => {
    if (trialDaysRemaining == null || hasPaidSubscription) return null;
    if (trialDaysRemaining < 0) return null;
    if (trialDaysRemaining === 0) return t("trial_last_day");
    if (trialDaysRemaining === 1) return t("trial_ending_soon");
    return t("trial_active", { days: trialDaysRemaining });
  })();

  return (
    <div ref={wrapRef} className="relative flex items-center gap-3">
      {trialBadge && (
        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-accent/10 text-accent-foreground border border-accent/30 px-3 py-1.5 text-xs font-medium">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 2l1.9 5.8H20l-4.9 3.6 1.9 5.8L12 13.6 7 17.2l1.9-5.8L4 7.8h6.1L12 2z" />
          </svg>
          {trialBadge}
        </span>
      )}

      {showUpgradeCta && (
        <Link
          href="/einstellungen/abrechnung"
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90"
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
            <path d="M12 4l8 12H4l8-12z" />
          </svg>
          {t("upgrade")}
        </Link>
      )}

      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("open_menu")}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 px-1 py-1 transition-colors"
      >
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 dark:bg-neutral-200 text-white dark:text-neutral-900 text-xs font-semibold"
          aria-hidden
        >
          {initial}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl z-40 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
            <p
              className="text-sm font-medium truncate"
              title={email}
            >
              {email}
            </p>
          </div>
          <nav className="py-1 text-sm">
            <button
              type="button"
              onClick={openPortal}
              disabled={portalPending}
              className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
              role="menuitem"
            >
              <IconReceipt />
              <span className="flex-1">{t("menu_my_invoices")}</span>
              {portalPending && (
                <span className="text-xs text-neutral-500">…</span>
              )}
            </button>
            {portalError && (
              <p className="px-4 pb-2 text-[11px] text-red-600 dark:text-red-400">
                {portalError}
              </p>
            )}
            <MenuLink href="/einstellungen/abrechnung" onClick={() => setOpen(false)}>
              <IconCard />
              <span className="flex-1">{t("menu_subscription")}</span>
              <span
                className={
                  "ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium " +
                  (hasPaidSubscription
                    ? "bg-accent/15 text-accent-foreground border border-accent/30"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300")
                }
              >
                {tierLabel}
              </span>
            </MenuLink>
            <MenuLink href="/einstellungen" onClick={() => setOpen(false)}>
              <IconSettings />
              <span className="flex-1">{t("menu_settings")}</span>
            </MenuLink>
            <MenuLink href="/einstellungen/empfehlung" onClick={() => setOpen(false)}>
              <IconGift />
              <span className="flex-1">{t("menu_referral")}</span>
            </MenuLink>
            <MenuLink href="/einstellungen/kuendigung" onClick={() => setOpen(false)}>
              <IconCancel />
              <span className="flex-1">{t("menu_cancel_contract")}</span>
            </MenuLink>
          </nav>
          <div className="border-t border-neutral-200 dark:border-neutral-800">
            <form action={logout}>
              <button
                type="submit"
                className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                role="menuitem"
              >
                <IconLogout />
                {t("menu_logout")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      role="menuitem"
      className="flex items-center gap-3 px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
    >
      {children}
    </Link>
  );
}

/* === Inline icons (Lucide-Geometrie, kein extra Paket) === */
function IconReceipt() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 2h16v20l-4-2-4 2-4-2-4 2V2z" />
      <path d="M8 7h8" /><path d="M8 11h8" /><path d="M8 15h5" />
    </svg>
  );
}
function IconCard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9 1.7 1.7 0 0 0 4.3 7.2l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
function IconGift() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13" />
      <path d="M4 12v9h16v-9" />
      <path d="M7.5 8a2.5 2.5 0 1 1 0-5C9 3 12 8 12 8" />
      <path d="M16.5 8a2.5 2.5 0 1 0 0-5C15 3 12 8 12 8" />
    </svg>
  );
}
function IconCancel() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <line x1="9.5" y1="14" x2="14.5" y2="19" />
      <line x1="14.5" y1="14" x2="9.5" y2="19" />
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
