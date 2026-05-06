import { LocaleSwitcher } from "@/components/locale-switcher";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950 p-6">
      <div className="absolute top-4 right-4">
        <LocaleSwitcher />
      </div>
      {children}
    </main>
  );
}
