"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export type CommandResult = {
  kind: "property" | "portfolio" | "owner" | "tenant";
  id: string;
  label: string;
  sublabel?: string;
  href: string;
};

/**
 * Globale ⌘K / Strg+K Suche (Spec Task 8). Lädt einmal alle Entitäten des
 * Workspace via /api/search und filtert dann clientseitig.
 */
export function CommandPalette() {
  const router = useRouter();
  const t = useTranslations("search");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CommandResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Global hotkey listener.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isCmdK) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Lazy-load items on first open.
  useEffect(() => {
    if (!open || items != null) return;
    setLoading(true);
    fetch("/api/search")
      .then((r) => r.json())
      .then((json: { results: CommandResult[] }) => {
        setItems(json.results ?? []);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open, items]);

  // Focus input when palette opens.
  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(id);
    }
  }, [open]);

  // Reset state when closed.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIdx(0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const all = items ?? [];
    if (!query.trim()) return all.slice(0, 30);
    const q = query.toLowerCase();
    return all
      .filter(
        (r) =>
          r.label.toLowerCase().includes(q) ||
          (r.sublabel ?? "").toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [items, query]);

  // Clamp activeIdx after filter changes.
  useEffect(() => {
    setActiveIdx(0);
  }, [query, items]);

  function onResultKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = filtered[activeIdx];
      if (hit) {
        setOpen(false);
        router.push(hit.href);
      }
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-24"
    >
      <div
        className="fixed inset-0 bg-black/40"
        aria-hidden
        onClick={() => setOpen(false)}
      />
      <div className="relative w-full max-w-xl rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 border-b border-neutral-200 dark:border-neutral-800 px-4 py-3">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-neutral-500"
            aria-hidden
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onResultKey}
            placeholder={t("placeholder")}
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <kbd className="hidden sm:inline-flex items-center rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-1.5 py-0.5 text-[10px] font-mono text-neutral-500">
            ESC
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-1">
          {loading && (
            <p className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400">
              {t("loading")}
            </p>
          )}
          {!loading && filtered.length === 0 && (
            <p className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400">
              {items == null ? t("loading") : t("empty")}
            </p>
          )}
          {filtered.map((r, i) => (
            <button
              key={`${r.kind}-${r.id}`}
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(r.href);
              }}
              onMouseMove={() => setActiveIdx(i)}
              className={`w-full text-left flex items-center gap-3 px-4 py-2.5 ${
                i === activeIdx
                  ? "bg-accent-soft text-accent-foreground"
                  : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              }`}
            >
              <KindIcon kind={r.kind} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium truncate">
                  {r.label}
                </span>
                {r.sublabel && (
                  <span className="block text-xs text-neutral-500 dark:text-neutral-400 truncate">
                    {r.sublabel}
                  </span>
                )}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400 shrink-0">
                {t(`kind_${r.kind}`)}
              </span>
            </button>
          ))}
        </div>

        <div className="border-t border-neutral-200 dark:border-neutral-800 px-4 py-2 flex items-center gap-3 text-[10px] text-neutral-500 dark:text-neutral-400">
          <span>
            <kbd className="inline-flex items-center rounded border border-neutral-300 dark:border-neutral-700 px-1 py-0.5 font-mono">
              ↑↓
            </kbd>{" "}
            {t("hint_navigate")}
          </span>
          <span>
            <kbd className="inline-flex items-center rounded border border-neutral-300 dark:border-neutral-700 px-1 py-0.5 font-mono">
              ↵
            </kbd>{" "}
            {t("hint_open")}
          </span>
        </div>
      </div>
    </div>
  );
}

function KindIcon({ kind }: { kind: CommandResult["kind"] }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent border border-accent/30 shrink-0">
      {kind === "property" && (
        <svg {...common}>
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
          <path d="M9 22v-4h6v4" />
        </svg>
      )}
      {kind === "portfolio" && (
        <svg {...common}>
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      )}
      {kind === "owner" && (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      )}
      {kind === "tenant" && (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )}
    </span>
  );
}
