import Link from "next/link";

/**
 * Datenschutzerklärung — Stand 07.06.2026 · Version 1.0
 *
 * TODO vor Final-Veröffentlichung:
 *  - § 1: Vollständige Anschrift + Vertretungsberechtigte ergänzen
 *  - § 10: Aufsichtsbehörde abhängig vom GbR-Sitz prüfen
 *    (BayLDA gilt nur für Bayern)
 *
 * Faktenkorrekturen gegenüber Original-Entwurf (07.06.2026):
 *  - Supabase ist Paris (eu-west-3), nicht Frankfurt
 *  - Sitz vs. Verarbeitungsort sauber getrennt
 *  - Internes Kommentar-Memo aus § 4 entfernt
 *  - Cookies konkret aufgelistet (keine Tracking-Cookies)
 *  - Sicherheits-Abschnitt nach Art. 32 DSGVO ergänzt
 */
export default function DatenschutzPage() {
  return (
    <article className="prose dark:prose-invert max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight mb-2">
        Datenschutzerklärung — EstateAbly
      </h1>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-8">
        Stand: 07.06.2026 · Version: 1.0
      </p>

      <H2>1. Verantwortlicher</H2>
      <P>
        Verantwortlich für die Datenverarbeitung auf dieser Website und im
        Rahmen der eigenen Geschäftstätigkeit ist:
      </P>
      <div className="mt-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-4 text-sm leading-relaxed">
        <strong>Patrick Hümmer Max Strobel GbR</strong>
        <br />
        [Straße, Hausnummer]
        <br />
        [PLZ Ort], Deutschland
        <br />
        E-Mail:{" "}
        <a href="mailto:info@estateably.de" className="text-accent hover:underline">
          info@estateably.de
        </a>
        <br />
        Vertretungsberechtigt: Patrick Hümmer, Max Strobel
      </div>
      <P>
        Für Fragen zum Datenschutz erreichen Sie uns unter:{" "}
        <a href="mailto:info@estateably.de" className="text-accent hover:underline">
          info@estateably.de
        </a>
      </P>

      <H2>2. Überblick über die Verarbeitung</H2>
      <P>EstateAbly verarbeitet personenbezogene Daten in zwei unterschiedlichen Rollen:</P>
      <Ul>
        <li>
          <strong>Als Verantwortlicher</strong> verarbeiten wir Ihre Daten (z. B. Kontakt-, Konto- und Zahlungsdaten), um Ihnen den Dienst bereitzustellen und den Vertrag zu erfüllen. Diese Verarbeitung beschreibt die vorliegende Datenschutzerklärung.
        </li>
        <li>
          <strong>Als Auftragsverarbeiter</strong> verarbeiten wir personenbezogene Daten Dritter (insbesondere Mieterdaten), die Sie als Nutzer in die Software eingeben. In diesem Verhältnis sind Sie der Verantwortliche und wir handeln ausschließlich nach Ihrer Weisung. Die Bedingungen dieser Auftragsverarbeitung regelt der separate <Link href="/legal/avv" className="text-accent hover:underline">Auftragsverarbeitungsvertrag (AVV)</Link>, der mit Abschluss des Hauptvertrages Bestandteil des Vertragsverhältnisses wird.
        </li>
      </Ul>

      <H2>3. Welche Daten wir als Verantwortlicher verarbeiten</H2>

      <H3>3.1 Registrierung und Nutzerkonto</H3>
      <Dl>
        <Dt>Daten</Dt>
        <Dd>Name, E-Mail-Adresse, Passwort (gehasht), ggf. Firmenname und Anschrift.</Dd>
        <Dt>Zweck</Dt>
        <Dd>Einrichtung und Verwaltung Ihres Kontos, Authentifizierung, Kommunikation.</Dd>
        <Dt>Rechtsgrundlage</Dt>
        <Dd>Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).</Dd>
        <Dt>Speicherdauer</Dt>
        <Dd>Bis zur Löschung des Kontos, danach gemäß gesetzlichen Aufbewahrungsfristen (§ 147 AO, § 257 HGB: bis zu 10 Jahre für steuerlich relevante Daten).</Dd>
      </Dl>

      <H3>3.2 Zahlungsabwicklung</H3>
      <Dl>
        <Dt>Daten</Dt>
        <Dd>Zahlungsdaten (Kreditkarten-/Kontodaten werden tokenisiert durch Stripe verarbeitet; wir selbst speichern keine vollständigen Zahlungsdaten), Rechnungsadresse, Transaktionshistorie.</Dd>
        <Dt>Zweck</Dt>
        <Dd>Abwicklung der Zahlung für Abonnement und Einmalkäufe.</Dd>
        <Dt>Rechtsgrundlage</Dt>
        <Dd>Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).</Dd>
        <Dt>Dienstleister</Dt>
        <Dd>
          Stripe Payments Europe, Ltd., 1 Grand Canal Street Lower, Dublin 2,
          Irland. Stripe verarbeitet Zahlungsdaten als eigenständiger
          Verantwortlicher im Rahmen seiner Zahlungsdienste und als
          Auftragsverarbeiter im Rahmen unserer Weisungen. Es gilt die
          Datenschutzerklärung von Stripe:{" "}
          <a
            href="https://stripe.com/de/privacy"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            stripe.com/de/privacy
          </a>
          .
        </Dd>
        <Dt>Speicherdauer</Dt>
        <Dd>Transaktionsdaten gemäß gesetzlichen Aufbewahrungsfristen (bis zu 10 Jahre).</Dd>
      </Dl>

      <H3>3.3 Nutzung der Website und des Dienstes</H3>
      <Dl>
        <Dt>Daten</Dt>
        <Dd>IP-Adresse, Browsertyp, Betriebssystem, Zugriffszeit, aufgerufene Seiten (Server-Log-Dateien); bei Nutzung des Dienstes zusätzlich Nutzungsdaten (Funktionsaufrufe, Sitzungsdauer).</Dd>
        <Dt>Zweck</Dt>
        <Dd>Bereitstellung und Sicherheit des Dienstes, Fehleranalyse, Kapazitätsplanung.</Dd>
        <Dt>Rechtsgrundlage</Dt>
        <Dd>Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an stabilem und sicherem Betrieb).</Dd>
        <Dt>Speicherdauer</Dt>
        <Dd>Server-Logdaten werden 30 Tage nach Erhebung gelöscht.</Dd>
      </Dl>

      <H3>3.4 Kommunikation</H3>
      <Dl>
        <Dt>Daten</Dt>
        <Dd>Inhalt Ihrer Anfrage, E-Mail-Adresse, Name.</Dd>
        <Dt>Zweck</Dt>
        <Dd>Bearbeitung Ihrer Anfrage, Kundensupport.</Dd>
        <Dt>Rechtsgrundlage</Dt>
        <Dd>Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche Maßnahme / Vertragserfüllung) bzw. lit. f (berechtigtes Interesse an Kundenbetreuung).</Dd>
        <Dt>Speicherdauer</Dt>
        <Dd>Bis zur Erledigung der Anfrage, danach gemäß Aufbewahrungsfristen.</Dd>
      </Dl>

      <H2>4. Cookies und Tracking</H2>

      <H3>4.1 Technisch notwendige Cookies</H3>
      <P>Wir setzen Cookies ein, die für den Betrieb des Dienstes zwingend erforderlich sind. Diese Cookies werden ohne Einwilligung gesetzt (§ 25 Abs. 2 Nr. 2 TDDDG). Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.</P>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-neutral-300 dark:border-neutral-700">
              <Th>Cookie</Th>
              <Th>Zweck</Th>
              <Th>Speicherdauer</Th>
            </tr>
          </thead>
          <tbody>
            <CookieRow name="sb-*-auth-token" purpose="Authentifizierungs-Session (Supabase Auth)" duration="Session bzw. bis Logout" />
            <CookieRow name="estateably-theme" purpose="Anzeige-Präferenz (Hell/Dunkel)" duration="dauerhaft, bis vom Nutzer gelöscht" />
            <CookieRow name="estateably-sidebar-collapsed" purpose="Sidebar-Zustand (auf/zugeklappt)" duration="dauerhaft, bis vom Nutzer gelöscht" />
            <CookieRow name="estateably-hint:*" purpose="Status der UI-Hinweisbanner" duration="dauerhaft, bis vom Nutzer gelöscht" />
            <CookieRow name="estateably-onboarding-dismissed" purpose="Status des Onboarding-Banners" duration="dauerhaft, bis vom Nutzer gelöscht" />
          </tbody>
        </table>
      </div>

      <H3>4.2 Analyse- und Marketing-Cookies</H3>
      <P>Wir setzen derzeit keine Analyse- oder Marketing-Cookies ein.</P>

      <H2>5. Empfänger und Dienstleister</H2>
      <P>Wir geben personenbezogene Daten nur weiter, wenn dies zur Vertragserfüllung erforderlich ist, eine Rechtsgrundlage besteht oder Sie eingewilligt haben. Folgende Dienstleister sind im Einsatz:</P>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-neutral-300 dark:border-neutral-700">
              <Th>Dienstleister</Th>
              <Th>Leistung</Th>
              <Th>Sitz / Verarbeitungsort</Th>
              <Th>Daten</Th>
            </tr>
          </thead>
          <tbody>
            <ServiceRow
              name="Vercel Inc."
              service="Hosting, Serverless-Functions, CDN"
              location="Sitz USA / Verarbeitung Frankfurt (fra1)"
              data="IP-Adressen, Nutzungsdaten, Inhalte der Anwendung"
            />
            <ServiceRow
              name="Supabase Inc."
              service="Datenbank, Authentifizierung, Speicher"
              location="Sitz USA / Verarbeitung Paris (eu-west-3)"
              data="Alle in der Anwendung gespeicherten Daten (inkl. Mieterdaten als Auftragsverarbeitung)"
            />
            <ServiceRow
              name="Stripe Payments Europe, Ltd."
              service="Zahlungsabwicklung"
              location="Dublin, Irland (EU); Group-Daten teilweise USA"
              data="Zahlungsdaten, Rechnungsadresse, Transaktionsdaten"
            />
            <ServiceRow
              name="united-domains AG"
              service="Domain, E-Mail-Postfach"
              location="Starnberg, Deutschland (EU)"
              data="E-Mail-Inhalte, technische Domainverwaltung"
            />
            <ServiceRow
              name="GitHub Inc."
              service="Quellcode-Verwaltung (kein Endkunden-Zugriff)"
              location="Sitz USA"
              data="Nur Anwendungs-Quellcode, keine personenbezogenen Endkunden-Daten"
            />
          </tbody>
        </table>
      </div>

      <H2>6. Übermittlung in Drittländer (USA)</H2>
      <P>
        Vercel und Supabase haben ihren Unternehmenssitz in den USA. Die
        eigentliche Datenverarbeitung erfolgt in EU-Rechenzentren (Supabase:
        Paris; Vercel: Frankfurt). Soweit dennoch eine Übermittlung in die USA
        stattfindet, stützen wir uns auf:
      </P>
      <Ul>
        <li>den Angemessenheitsbeschluss der EU-Kommission zum EU-US Data Privacy Framework vom 10.07.2023 (Art. 45 DSGVO), soweit der Anbieter DPF-zertifiziert ist;</li>
        <li>ergänzend bzw. ersatzweise EU-Standardvertragsklauseln (Durchführungsbeschluss (EU) 2021/914) mit zusätzlichen Schutzmaßnahmen.</li>
      </Ul>
      <P>Stripe verarbeitet Zahlungsdaten über seine EU-Gesellschaft (Stripe Payments Europe, Ltd., Dublin). Soweit Daten in die USA übermittelt werden, ist Stripe unter dem EU-US Data Privacy Framework zertifiziert und setzt zusätzlich Standardvertragsklauseln ein.</P>

      <H2>7. Sicherheit der Verarbeitung</H2>
      <P>Wir treffen geeignete technische und organisatorische Maßnahmen nach Art. 32 DSGVO, um Ihre Daten zu schützen:</P>
      <Ul>
        <li>Transport-Verschlüsselung (TLS) für die gesamte Datenübertragung;</li>
        <li>Encryption at Rest (AES-256) auf Datenbankebene durch Supabase;</li>
        <li>Mandantentrennung über Row-Level-Security (Supabase RLS);</li>
        <li>Regelmäßige automatische Backups (Supabase) mit Point-in-Time-Recovery;</li>
        <li>Mehr-Faktor-Authentifizierung für administrative Zugänge der Anbieterseite.</li>
      </Ul>

      <H2>8. Speicherdauer (allgemein)</H2>
      <P>Personenbezogene Daten werden nur so lange gespeichert, wie dies für den jeweiligen Zweck erforderlich ist oder gesetzliche Aufbewahrungsfristen bestehen. Nach Ablauf werden die Daten gelöscht oder anonymisiert. Die konkreten Fristen sind bei den einzelnen Verarbeitungen in Abschnitt 3 angegeben.</P>

      <H2>9. Ihre Rechte als betroffene Person</H2>
      <P>Sie haben gegenüber uns als Verantwortlichem folgende Rechte:</P>
      <Ul>
        <li>Auskunft (Art. 15 DSGVO) über die von uns verarbeiteten Daten;</li>
        <li>Berichtigung (Art. 16 DSGVO) unrichtiger oder unvollständiger Daten;</li>
        <li>Löschung (Art. 17 DSGVO), soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen;</li>
        <li>Einschränkung der Verarbeitung (Art. 18 DSGVO);</li>
        <li>Datenübertragbarkeit (Art. 20 DSGVO) — Sie können Ihre Daten in einem gängigen, maschinenlesbaren Format erhalten;</li>
        <li>Widerspruch (Art. 21 DSGVO) gegen die Verarbeitung auf Basis berechtigter Interessen;</li>
        <li>Widerruf einer erteilten Einwilligung jederzeit mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO).</li>
      </Ul>
      <P>
        Anfragen richten Sie an:{" "}
        <a href="mailto:info@estateably.de" className="text-accent hover:underline">
          info@estateably.de
        </a>
      </P>

      <H2>10. Beschwerderecht bei einer Aufsichtsbehörde</H2>
      <P>
        Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren (Art. 77 DSGVO). Zuständige Behörde für den Anbieter ist:
      </P>
      <div className="mt-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-4 text-sm leading-relaxed">
        Bayerisches Landesamt für Datenschutzaufsicht (BayLDA)
        <br />
        Promenade 18, 91522 Ansbach
        <br />
        Tel.: 0981 180093-0
        <br />
        E-Mail:{" "}
        <a href="mailto:poststelle@lda.bayern.de" className="text-accent hover:underline">
          poststelle@lda.bayern.de
        </a>
        <br />
        Web:{" "}
        <a
          href="https://www.lda.bayern.de"
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:underline"
        >
          lda.bayern.de
        </a>
      </div>

      <H2>11. Pflicht zur Bereitstellung von Daten</H2>
      <P>Die Bereitstellung der in Abschnitt 3.1 und 3.2 genannten Daten ist für den Vertragsschluss und die Nutzung des Dienstes erforderlich. Ohne diese Daten können wir den Vertrag nicht erfüllen.</P>

      <H2>12. Automatisierte Entscheidungsfindung</H2>
      <P>Die im Dienst enthaltenen Bewertungs-, Score- und Cashflow-Funktionen sind reine Anzeige- und Berechnungshilfen auf Basis der vom Nutzer eingegebenen Daten. Eine automatisierte Entscheidung mit rechtlicher Wirkung i. S. v. Art. 22 DSGVO findet nicht statt; ebenso kein Profiling.</P>

      <H2>13. Verbraucherstreitbeilegung</H2>
      <P>Wir sind zur Teilnahme an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle weder verpflichtet noch bereit (§ 36 VSBG).</P>

      <hr className="my-12 border-neutral-200 dark:border-neutral-800" />
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Stand: 07.06.2026 · Version: 1.0 · Anbieter: Patrick Hümmer Max Strobel GbR
      </p>
    </article>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 text-xl font-semibold tracking-tight">{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-6 text-base font-semibold">{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">{children}</p>;
}
function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 list-disc pl-5">{children}</ul>;
}
function Dl({ children }: { children: React.ReactNode }) {
  return <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm text-neutral-700 dark:text-neutral-300">{children}</dl>;
}
function Dt({ children }: { children: React.ReactNode }) {
  return <dt className="font-medium">{children}</dt>;
}
function Dd({ children }: { children: React.ReactNode }) {
  return <dd>{children}</dd>;
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 align-top text-neutral-700 dark:text-neutral-300">{children}</td>;
}
function CookieRow({ name, purpose, duration }: { name: string; purpose: string; duration: string }) {
  return (
    <tr className="border-b border-neutral-200 dark:border-neutral-800">
      <Td><code className="font-mono text-[11px]">{name}</code></Td>
      <Td>{purpose}</Td>
      <Td>{duration}</Td>
    </tr>
  );
}
function ServiceRow({ name, service, location, data }: { name: string; service: string; location: string; data: string }) {
  return (
    <tr className="border-b border-neutral-200 dark:border-neutral-800">
      <Td><strong>{name}</strong></Td>
      <Td>{service}</Td>
      <Td>{location}</Td>
      <Td>{data}</Td>
    </tr>
  );
}
