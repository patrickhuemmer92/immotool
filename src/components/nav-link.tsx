"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active =
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        "block rounded-md px-2 py-1.5 transition-colors " +
        (active
          ? "bg-accent-soft text-accent-foreground font-medium border-l-2 border-accent -ml-[2px] pl-[10px]"
          : "hover:bg-neutral-100 text-neutral-700")
      }
    >
      {children}
    </Link>
  );
}
