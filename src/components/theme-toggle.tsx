"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Mode = "light" | "dark" | "system";
const STORAGE_KEY = "estateably-theme";

function applyMode(mode: Mode) {
  const root = document.documentElement;
  const effective =
    mode === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : mode;
  root.classList.toggle("dark", effective === "dark");
}

export function ThemeToggle() {
  const t = useTranslations();
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Mode | null) ?? "system";
    setMode(stored);
    applyMode(stored);

    // Re-evaluate when the user is on `system` and the OS preference flips.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function onChange() {
      const current = (localStorage.getItem(STORAGE_KEY) as Mode | null) ?? "system";
      if (current === "system") applyMode("system");
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function change(next: Mode) {
    setMode(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyMode(next);
  }

  return (
    <div
      className="inline-flex rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs overflow-hidden"
      role="radiogroup"
      aria-label={t("theme.switch_label")}
    >
      <ModeButton current={mode} value="light" onClick={change} label={t("theme.light")}>
        ☀
      </ModeButton>
      <ModeButton current={mode} value="system" onClick={change} label={t("theme.system")}>
        ⌂
      </ModeButton>
      <ModeButton current={mode} value="dark" onClick={change} label={t("theme.dark")}>
        ☾
      </ModeButton>
    </div>
  );
}

function ModeButton({
  current,
  value,
  onClick,
  children,
  label,
}: {
  current: Mode;
  value: Mode;
  onClick: (next: Mode) => void;
  children: React.ReactNode;
  label: string;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      onClick={() => onClick(value)}
      title={label}
      className={
        "px-2 py-1 transition-colors " +
        (active
          ? "bg-accent text-accent-foreground font-medium"
          : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800")
      }
    >
      {children}
    </button>
  );
}
