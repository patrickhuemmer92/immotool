"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const STORAGE_KEY = "estateably-sidebar-collapsed";

export type NavIconName =
  | "dashboard"
  | "building"
  | "briefcase"
  | "user"
  | "users"
  | "calculator"
  | "building-bank"
  | "chart-line"
  | "trending-up"
  | "wand";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
};

export type SidebarGroup = {
  /** undefined → no header */
  heading?: string;
  items: NavItem[];
};

export function AppSidebar({
  groups,
  brandLabel,
  brandTagline,
  collapseLabelOn,
  collapseLabelOff,
}: {
  groups: SidebarGroup[];
  brandLabel: string;
  brandTagline: string;
  collapseLabelOn: string;
  collapseLabelOff: string;
}) {
  const [collapsed, setCollapsed] = useState<boolean | null>(null);

  // Read once on mount — avoid hydration flash by keeping a "loading" state.
  useEffect(() => {
    const stored =
      typeof window === "undefined"
        ? null
        : window.localStorage.getItem(STORAGE_KEY);
    setCollapsed(stored === "1");
  }, []);

  function toggle() {
    setCollapsed((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore — private mode etc.
      }
      return next;
    });
  }

  // SSR / before-mount: default to expanded (60). Once we know, switch.
  const isCollapsed = collapsed === true;
  const widthClass = isCollapsed ? "w-16" : "w-60";

  return (
    <aside
      className={`${widthClass} shrink-0 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col transition-[width] duration-200`}
      data-collapsed={isCollapsed ? "true" : "false"}
    >
      <div className="px-3 py-5 border-b border-neutral-200 dark:border-neutral-800">
        <Link
          href="/dashboard"
          aria-label={brandLabel}
          className="flex items-center gap-2 px-2 hover:opacity-80"
        >
          <BrandGlyph />
          {!isCollapsed && (
            <span className="flex flex-col leading-tight">
              <span className="text-xl font-bold tracking-tight">
                {brandLabel}
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400 mt-0.5">
                {brandTagline}
              </span>
            </span>
          )}
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1 text-sm overflow-y-auto">
        {groups.map((g, gi) => (
          <SidebarGroupView
            key={gi}
            heading={g.heading}
            items={g.items}
            collapsed={isCollapsed}
          />
        ))}
      </nav>

      <div className="p-2 border-t border-neutral-200 dark:border-neutral-800">
        <button
          type="button"
          onClick={toggle}
          aria-label={isCollapsed ? collapseLabelOff : collapseLabelOn}
          title={isCollapsed ? collapseLabelOff : collapseLabelOn}
          className="w-full flex items-center justify-center gap-2 rounded-md px-2 py-1.5 text-xs text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <CollapseIcon flipped={isCollapsed} />
          {!isCollapsed && <span>{collapseLabelOn}</span>}
        </button>
      </div>
    </aside>
  );
}

function SidebarGroupView({
  heading,
  items,
  collapsed,
}: {
  heading?: string;
  items: NavItem[];
  collapsed: boolean;
}) {
  return (
    <div className="mb-3">
      {heading && !collapsed && (
        <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {heading}
        </div>
      )}
      {heading && collapsed && (
        <div className="mx-2 my-2 border-t border-neutral-200 dark:border-neutral-800" />
      )}
      <div className="space-y-0.5">
        {items.map((it) => (
          <NavRow key={it.href} item={it} collapsed={collapsed} />
        ))}
      </div>
    </div>
  );
}

function NavRow({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const active =
    item.href === "/"
      ? pathname === "/"
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const baseCls = collapsed
    ? "flex items-center justify-center rounded-md py-2 transition-colors"
    : "flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors";

  const activeCls = active
    ? "bg-accent-soft text-accent-foreground font-medium"
    : "hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300";

  const indicator = active && !collapsed ? (
    <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r bg-accent" />
  ) : null;

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={`relative ${baseCls} ${activeCls}`}
    >
      {indicator}
      <span
        className={
          (collapsed ? "" : "") +
          (active ? " text-accent" : " text-neutral-500 dark:text-neutral-400")
        }
        aria-hidden
      >
        <NavIcon name={item.icon} />
      </span>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

/* ============ Inline Icons (Lucide-Geometrie, 18px) ============ */

function NavIcon({ name }: { name: NavIconName }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      );
    case "building":
      return (
        <svg {...common}>
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M9 22v-4h6v4" />
          <path d="M8 6h.01" /><path d="M16 6h.01" />
          <path d="M8 10h.01" /><path d="M16 10h.01" />
          <path d="M8 14h.01" /><path d="M16 14h.01" />
        </svg>
      );
    case "briefcase":
      return (
        <svg {...common}>
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "calculator":
      return (
        <svg {...common}>
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M8 6h8v4H8z" />
          <path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" />
          <path d="M8 18h.01" /><path d="M12 18h.01" /><path d="M16 18h.01" />
        </svg>
      );
    case "building-bank":
      return (
        <svg {...common}>
          <path d="M3 21h18" />
          <path d="M3 10h18" />
          <path d="M12 2L3 7v3h18V7l-9-5z" />
          <path d="M6 10v8" /><path d="M10 10v8" />
          <path d="M14 10v8" /><path d="M18 10v8" />
        </svg>
      );
    case "chart-line":
      return (
        <svg {...common}>
          <path d="M3 3v18h18" />
          <path d="M7 14l4-4 4 3 5-7" />
        </svg>
      );
    case "trending-up":
      return (
        <svg {...common}>
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M14 7h7v7" />
        </svg>
      );
    case "wand":
      return (
        <svg {...common}>
          <path d="M15 4V2" /><path d="M15 16v-2" />
          <path d="M8 9h2" /><path d="M20 9h2" />
          <path d="M17.8 11.8L19 13" /><path d="M15 9h0" />
          <path d="M17.8 6.2L19 5" /><path d="M3 21l9-9" />
          <path d="M12.2 6.2L11 5" />
        </svg>
      );
  }
}

function BrandGlyph() {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent border border-accent/30">
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        aria-hidden
        focusable="false"
      >
        <path
          d="M2 13 L8 3 L14 13"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function CollapseIcon({ flipped }: { flipped: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: flipped ? "rotate(180deg)" : undefined }}
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
