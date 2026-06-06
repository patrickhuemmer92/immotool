"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Sichtbarer Trigger für die ⌘K-Suche: dispatcht ein KeyboardEvent
 * (Ctrl+K), das vom CommandPalette-Listener gefangen wird. Spart einen
 * geteilten Context — das Hotkey ist eh schon global.
 */
export function CommandPaletteTrigger() {
  const t = useTranslations("search");
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsMac(navigator.platform.toLowerCase().includes("mac"));
    }
  }, []);

  function open() {
    const init: KeyboardEventInit = {
      key: "k",
      ctrlKey: !isMac,
      metaKey: isMac,
      bubbles: true,
    };
    window.dispatchEvent(new KeyboardEvent("keydown", init));
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-label={t("open_button")}
      className="hidden md:inline-flex items-center gap-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
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
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <span>{t("placeholder")}</span>
      <kbd className="inline-flex items-center gap-0.5 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-1 py-0.5 text-[10px] font-mono">
        {isMac ? "⌘" : "Ctrl"}K
      </kbd>
    </button>
  );
}
