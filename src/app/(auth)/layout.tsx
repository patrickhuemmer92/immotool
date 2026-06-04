import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations();
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ backgroundColor: "var(--color-neutral-900)" }}
    >
      {/* Subtle teal accent glow so the dark canvas isn't flat. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full blur-3xl opacity-25"
        style={{ backgroundColor: "var(--color-accent)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-24 w-[300px] h-[300px] rounded-full blur-3xl opacity-15"
        style={{ backgroundColor: "var(--color-accent)" }}
      />

      <div className="absolute top-4 right-4 z-10">
        <div className="rounded-md bg-white/10 backdrop-blur-sm text-white">
          <LocaleSwitcher />
        </div>
      </div>

      <div className="relative z-10 w-full flex justify-center">{children}</div>

      {/* Footer-Links zu Pflichtangaben — Datenschutz/Impressum/AGB
          müssen auch in der Auth-Sicht erreichbar sein. */}
      <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center gap-4 text-xs text-white/60">
        <Link href="/impressum" className="hover:text-white">
          {t("legal.footer_impressum")}
        </Link>
        <Link href="/datenschutz" className="hover:text-white">
          {t("legal.footer_privacy")}
        </Link>
        <Link href="/agb" className="hover:text-white">
          {t("legal.footer_terms")}
        </Link>
      </div>
    </main>
  );
}
