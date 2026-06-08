import { MarketingNav } from "./_components/marketing-nav";
import { MarketingFooter } from "./_components/marketing-footer";

/**
 * Layout für die öffentliche Marketing-Seite (Landing + Pricing).
 * Aktiviert das dunkle Marketing-Theme über die `.marketing-shell`-Klasse
 * — die Tokens dafür sind in src/app/globals.css definiert und greifen
 * NUR innerhalb dieses Wrappers. App-Seiten bleiben unberührt hell.
 *
 * Public route: KEIN Auth-Check hier. Eingeloggte User werden in
 * src/lib/supabase/middleware.ts direkt nach /dashboard umgeleitet,
 * sehen die Marketing-Seite also nie.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="marketing-shell min-h-screen">
      <MarketingNav />
      {children}
      <MarketingFooter />
    </div>
  );
}
