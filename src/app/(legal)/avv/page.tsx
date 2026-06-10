/**
 * Auftragsverarbeitungsvertrag (AVV) nach Art. 28 DSGVO
 * Stand 07.06.2026 · Version 1.0
 *
 * Korrekturen gegenüber Original-Entwurf:
 *  - Anschrift Landsberger Str. 440a, 81241 München eingesetzt
 *  - Sitz vs. Verarbeitungsort in Anlage 3 sauber getrennt
 *  - PRÜFPUNKT-Marker durch konkrete Aussagen ersetzt
 *  - DPO-Hinweis (keine Pflicht bei 2-Personen-GbR ohne Mitarbeiter)
 *  - Gerichtsstand München in § 11 ergänzt
 *  - TOM-Anlage 2: "zu verifizieren" durch konkrete Belege ersetzt
 *  - Supabase-Region: Paris (eu-west-3), nicht Frankfurt
 */
export default function AvvPage() {
  return (
    <article className="prose dark:prose-invert max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight mb-2">
        Auftragsverarbeitungsvertrag (AVV) nach Art. 28 DSGVO — EstateAbly
      </h1>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-8">
        Stand: 07.06.2026 · Version: 1.0
      </p>

      <H2>Präambel</H2>
      <P>
        Dieser Auftragsverarbeitungsvertrag (nachfolgend „AVV") konkretisiert
        die datenschutzrechtlichen Pflichten der Parteien aus dem zwischen
        ihnen geschlossenen Hauptvertrag über die Nutzung der Software
        „EstateAbly" (nachfolgend „Hauptvertrag").
      </P>
      <P>
        Bei der Nutzung von EstateAbly verarbeitet der Anbieter
        personenbezogene Daten im Auftrag und nach Weisung des Kunden. Der
        Kunde ist datenschutzrechtlich Verantwortlicher (Art. 4 Nr. 7 DSGVO),
        der Anbieter Auftragsverarbeiter (Art. 4 Nr. 8 DSGVO).
      </P>
      <P>
        <strong>Verantwortlicher (Auftraggeber):</strong> der Kunde gemäß
        Hauptvertrag (nachfolgend „Verantwortlicher").
      </P>
      <P>
        <strong>Auftragsverarbeiter (Auftragnehmer):</strong>
      </P>
      <div className="mt-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-4 text-sm leading-relaxed">
        <strong>Patrick Hümmer Max Strobel GbR</strong>
        <br />
        Landsberger Straße 440a
        <br />
        81241 München, Deutschland
        <br />
        Vertretungsberechtigt: Patrick Hümmer, Max Strobel
        <br />
        E-Mail Datenschutz:{" "}
        <a
          href="mailto:info@estateably.de"
          className="text-accent hover:underline"
        >
          info@estateably.de
        </a>
        <br />
        (nachfolgend „Auftragnehmer")
      </div>

      <H2>§ 1 — Gegenstand und Dauer</H2>
      <P>
        Gegenstand des Auftrags ist die Verarbeitung personenbezogener Daten
        durch den Auftragnehmer im Rahmen der Bereitstellung und des
        Betriebs der Software gemäß Hauptvertrag. Art, Umfang und Zweck der
        Verarbeitung, die Art der Daten sowie die Kategorien betroffener
        Personen ergeben sich aus Anlage 1.
      </P>
      <P>
        Die Dauer dieses AVV entspricht der Laufzeit des Hauptvertrages.
        Endet der Hauptvertrag, endet auch dieser AVV; die Pflichten zur
        Löschung/Rückgabe (§ 9) bleiben bestehen.
      </P>

      <H2>§ 2 — Weisungsrecht des Verantwortlichen</H2>
      <P>
        Der Auftragnehmer verarbeitet die personenbezogenen Daten
        ausschließlich auf dokumentierte Weisung des Verantwortlichen, es
        sei denn, er ist nach dem Recht der Union oder der Mitgliedstaaten
        zur Verarbeitung verpflichtet (Art. 28 Abs. 3 lit. a DSGVO). In
        diesem Fall teilt er dem Verantwortlichen die rechtlichen
        Anforderungen vor der Verarbeitung mit, soweit das Recht dies nicht
        verbietet.
      </P>
      <P>
        Die Nutzung der Software durch den Verantwortlichen und die im
        Hauptvertrag beschriebenen Funktionen stellen die maßgeblichen
        Weisungen dar. Ergänzende Einzelweisungen erfolgen in Textform.
      </P>
      <P>
        Der Auftragnehmer informiert den Verantwortlichen unverzüglich,
        wenn er der Auffassung ist, dass eine Weisung gegen
        datenschutzrechtliche Vorschriften verstößt. Er ist berechtigt, die
        Durchführung der betreffenden Weisung auszusetzen, bis sie
        bestätigt oder geändert wird.
      </P>

      <H2>§ 3 — Pflichten des Auftragnehmers</H2>
      <P>Der Auftragnehmer verpflichtet sich insbesondere,</P>
      <Ul>
        <li>Daten nur im Rahmen des Auftrags und der Weisungen zu verarbeiten;</li>
        <li>
          alle zur Verarbeitung befugten Personen zur Vertraulichkeit zu
          verpflichten, soweit sie nicht bereits einer gesetzlichen
          Verschwiegenheitspflicht unterliegen (Art. 28 Abs. 3 lit. b,
          Art. 29, 32 Abs. 4 DSGVO);
        </li>
        <li>
          die technischen und organisatorischen Maßnahmen nach Art. 32 DSGVO
          gemäß Anlage 2 umzusetzen und während der Vertragslaufzeit
          aufrechtzuerhalten;
        </li>
        <li>
          den Verantwortlichen bei der Erfüllung der Rechte betroffener
          Personen (Art. 12–23 DSGVO) sowie bei der Einhaltung der Pflichten
          aus Art. 32–36 DSGVO (Sicherheit, Meldung von Verletzungen,
          Datenschutz-Folgenabschätzung) angemessen zu unterstützen
          (Art. 28 Abs. 3 lit. e, f DSGVO);
        </li>
        <li>
          den Verantwortlichen unverzüglich, in der Regel innerhalb von
          24 Stunden nach Bekanntwerden, über eine Verletzung des Schutzes
          personenbezogener Daten zu informieren und bei den Pflichten nach
          Art. 33, 34 DSGVO zu unterstützen (Art der Verletzung, betroffene
          Datenkategorien, voraussichtliche Folgen, ergriffene Maßnahmen);
        </li>
        <li>
          ein Verzeichnis aller Kategorien von Verarbeitungstätigkeiten
          nach Art. 30 Abs. 2 DSGVO zu führen.
        </li>
      </Ul>
      <P>
        <strong>Datenschutzbeauftragter.</strong> Eine Pflicht zur Benennung
        eines Datenschutzbeauftragten nach Art. 37 DSGVO / § 38 BDSG besteht
        aufseiten des Auftragnehmers derzeit nicht (zwei Gesellschafter
        ohne weitere mit der Datenverarbeitung ständig befasste Personen).
        Datenschutzanfragen können an{" "}
        <a
          href="mailto:info@estateably.de"
          className="text-accent hover:underline"
        >
          info@estateably.de
        </a>{" "}
        gerichtet werden.
      </P>

      <H2>§ 4 — Technisch-organisatorische Maßnahmen (TOM)</H2>
      <P>
        Der Auftragnehmer trifft die in Anlage 2 beschriebenen technischen
        und organisatorischen Maßnahmen nach Art. 32 DSGVO.
      </P>
      <P>
        Die Maßnahmen können im Lauf der Zeit weiterentwickelt werden,
        dürfen das vereinbarte Schutzniveau jedoch nicht unterschreiten.
        Wesentliche Änderungen werden dokumentiert.
      </P>

      <H2>§ 5 — Unterauftragsverarbeiter (Subunternehmer)</H2>
      <P>
        Der Verantwortliche erteilt dem Auftragnehmer die allgemeine
        Genehmigung zum Einsatz weiterer Auftragsverarbeiter (Art. 28
        Abs. 2 Satz 2 DSGVO). Die zum Zeitpunkt des Vertragsschlusses
        eingesetzten Unterauftragsverarbeiter sind in Anlage 3 aufgeführt
        und gelten als genehmigt.
      </P>
      <P>
        Der Auftragnehmer informiert den Verantwortlichen rechtzeitig
        (mindestens 14 Tage vorher) über beabsichtigte Änderungen in
        Bezug auf die Hinzuziehung oder Ersetzung von
        Unterauftragsverarbeitern. Der Verantwortliche kann der Änderung
        aus wichtigem datenschutzrechtlichen Grund innerhalb von 14 Tagen
        in Textform widersprechen. Im Falle eines berechtigten
        Widerspruchs, der nicht ausgeräumt werden kann, ist der
        Verantwortliche zur außerordentlichen Kündigung des Hauptvertrages
        berechtigt.
      </P>
      <P>
        Der Auftragnehmer erlegt jedem Unterauftragsverarbeiter durch
        Vertrag dieselben Datenschutzpflichten auf, wie sie in diesem AVV
        festgelegt sind (Art. 28 Abs. 4 DSGVO), insbesondere hinreichende
        Garantien für geeignete technische und organisatorische Maßnahmen.
      </P>
      <P>
        Nicht als Unterauftragsverarbeiter im Sinne dieser Vorschrift
        gelten Nebenleistungen, die der Auftragnehmer als reine
        Hilfsleistung in Anspruch nimmt (z. B. Telekommunikations- oder
        Postdienste), sofern dabei keine auftragsbezogene Verarbeitung
        personenbezogener Daten erfolgt.
      </P>

      <H2>§ 6 — Übermittlung in Drittländer</H2>
      <P>
        Eine Verarbeitung personenbezogener Daten in einem Drittland findet
        nur statt, soweit die Voraussetzungen der Art. 44 ff. DSGVO erfüllt
        sind.
      </P>
      <P>
        Soweit eingesetzte Unterauftragsverarbeiter ihren Unternehmenssitz
        in den USA haben (siehe Anlage 3 — Vercel, Supabase), stützt sich
        die Übermittlung auf folgende Garantien:
      </P>
      <Ul>
        <li>
          vorrangig: Zertifizierung des jeweiligen Anbieters unter dem
          EU-US Data Privacy Framework (Angemessenheitsbeschluss der
          EU-Kommission vom 10.07.2023), soweit für die betreffende
          Verarbeitung einschlägig;
        </li>
        <li>
          ergänzend bzw. ersatzweise: Standardvertragsklauseln der
          EU-Kommission (Durchführungsbeschluss (EU) 2021/914) nebst
          erforderlicher zusätzlicher Schutzmaßnahmen;
        </li>
        <li>
          soweit möglich, Nutzung von Verarbeitungsregionen innerhalb der
          EU bzw. des EWR (Vercel: Frankfurt am Main; Supabase: Paris).
        </li>
      </Ul>
      <P>
        Stripe verarbeitet Zahlungsdaten über Stripe Payments Europe, Ltd.
        (Dublin, EU). Soweit Daten in die USA übermittelt werden, ist
        Stripe DPF-zertifiziert und setzt SCC ein.
      </P>

      <H2>§ 7 — Rechte betroffener Personen</H2>
      <P>
        Wendet sich eine betroffene Person mit einem Anliegen (Auskunft,
        Berichtigung, Löschung etc.) unmittelbar an den Auftragnehmer,
        leitet dieser das Anliegen unverzüglich an den Verantwortlichen
        weiter und beantwortet es nicht selbst, sofern er nicht vom
        Verantwortlichen dazu angewiesen wurde. Er unterstützt den
        Verantwortlichen im Rahmen seiner Möglichkeiten bei der Erfüllung
        der Betroffenenrechte.
      </P>

      <H2>§ 8 — Nachweis- und Kontrollrechte</H2>
      <P>
        Der Auftragnehmer weist dem Verantwortlichen die Einhaltung der
        Pflichten aus diesem AVV auf Anfrage in geeigneter Weise nach,
        insbesondere durch Vorlage geeigneter Dokumentation, Zertifikate
        oder Berichte (z. B. aktuelle Nachweise/Zertifizierungen der
        eingesetzten Rechenzentren bzw. Unterauftragsverarbeiter).
      </P>
      <P>
        Der Verantwortliche ist berechtigt, sich von der Einhaltung der
        getroffenen Maßnahmen zu überzeugen. Kontrollen erfolgen nach
        angemessener Vorankündigung, während der üblichen Geschäftszeiten
        und ohne unverhältnismäßige Störung des Betriebsablaufs.
        Vor-Ort-Kontrollen kommen nur in Betracht, soweit
        dokumentenbasierte Nachweise nicht ausreichen.
      </P>

      <H2>§ 9 — Löschung und Rückgabe nach Vertragsende</H2>
      <P>
        Nach Abschluss der Verarbeitungstätigkeit löscht der Auftragnehmer
        nach Wahl des Verantwortlichen alle personenbezogenen Daten oder
        gibt sie zurück und löscht vorhandene Kopien, sofern nicht nach
        Unions- oder mitgliedstaatlichem Recht eine Pflicht zur Speicherung
        besteht (Art. 28 Abs. 3 lit. g DSGVO).
      </P>
      <P>
        Dem Verantwortlichen wird vor der Löschung für einen Zeitraum von
        30 Tagen die Möglichkeit zum Export seiner Daten eingeräumt. Die
        Löschung wird auf Verlangen in Textform bestätigt.
      </P>

      <H2>§ 10 — Haftung</H2>
      <P>
        Für die Haftung gilt Art. 82 DSGVO. Im Innenverhältnis gelten
        ergänzend die Haftungsregelungen des Hauptvertrages, soweit sie
        zwingenden datenschutzrechtlichen Vorschriften nicht
        entgegenstehen.
      </P>

      <H2>§ 11 — Schlussbestimmungen</H2>
      <P>
        Bei Widersprüchen zwischen diesem AVV und dem Hauptvertrag gehen
        die Regelungen dieses AVV in Bezug auf die Auftragsverarbeitung
        vor.
      </P>
      <P>
        Änderungen bedürfen der Textform. Es gilt deutsches Recht.
        Ausschließlicher Gerichtsstand für Streitigkeiten aus diesem AVV
        ist — soweit gesetzlich zulässig — der Sitz des Auftragnehmers
        (München).
      </P>
      <P>
        Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der
        übrigen Bestimmungen unberührt; es gelten die gesetzlichen
        Vorschriften.
      </P>

      <H2>Anlage 1 — Gegenstand und Einzelheiten der Verarbeitung</H2>
      <P>
        <strong>Gegenstand der Verarbeitung:</strong> Bereitstellung und
        Betrieb der SaaS-Anwendung EstateAbly zur Verwaltung und Auswertung
        von Immobilien-Portfoliodaten.
      </P>
      <P>
        <strong>Art der Verarbeitung:</strong> Erheben, Erfassen,
        Speichern, Organisieren, Auslesen, Verwenden (Anzeigen, Auswerten,
        Berichte erstellen), Löschen.
      </P>
      <P>
        <strong>Zweck der Verarbeitung:</strong> Vertragsgemäße Nutzung der
        Software durch den Verantwortlichen, insbesondere Pflege von
        Objekt-, Mieter-, Darlehens- und Finanzdaten sowie Erstellung von
        Factbooks und Auswertungen.
      </P>
      <P>
        <strong>Art der personenbezogenen Daten:</strong>
      </P>
      <Ul>
        <li>Stammdaten von Mieterinnen/Mietern (Name, Anschrift, Geburtsdatum, Kontaktdaten)</li>
        <li>Vertragsdaten (Mietvertragsbeginn/-ende, Miethöhe, Kaution, Staffel-/Indexangaben)</li>
        <li>Zahlungs-/Kontodaten im Zusammenhang mit Mietzahlungen</li>
        <li>Korrespondenz und Dokumente mit Personenbezug</li>
        <li>Ggf. Bonitäts-/Selbstauskunftsdaten, Zählerstände</li>
      </Ul>
      <P className="text-xs text-neutral-500 dark:text-neutral-400">
        Besondere Datenkategorien nach Art. 9 DSGVO (z. B. Gesundheitsdaten)
        werden im Rahmen der Software nicht erfasst.
      </P>
      <P>
        <strong>Kategorien betroffener Personen:</strong>
      </P>
      <Ul>
        <li>aktuelle, frühere und potenzielle Mieterinnen/Mieter</li>
        <li>ggf. Bürgen, Mitbewohner, Ansprechpartner</li>
        <li>ggf. Ansprechpartner von Dienstleistern, Handwerkern, Hausverwaltungen</li>
      </Ul>

      <H2>Anlage 2 — Technische und organisatorische Maßnahmen (Art. 32 DSGVO)</H2>

      <H3>1. Vertraulichkeit</H3>
      <Ul>
        <li>
          <strong>Zutrittskontrolle:</strong> Hosting in zertifizierten
          Rechenzentren der Unterauftragsverarbeiter — Vercel: SOC 2 Type
          II + ISO 27001 (Vercel Trust Center); Supabase: SOC 2 Type II +
          ISO 27001 (Supabase Trust Report); Stripe: PCI DSS Level 1, SOC
          1/2 Type II, ISO 27001.
        </li>
        <li>
          <strong>Zugangskontrolle:</strong> Individuelle Benutzerkonten,
          Passwort-Mindestanforderungen (≥ 8 Zeichen) durch Supabase Auth,
          Mehr-Faktor-Authentifizierung für administrative Zugänge der
          Anbieterseite (Vercel, Supabase, Stripe, GitHub) aktiviert.
        </li>
        <li>
          <strong>Zugriffskontrolle:</strong> Rollenbasiertes
          Berechtigungskonzept (RBAC: Owner / Editor / Viewer),
          Mandantentrennung über Row-Level-Security (Supabase RLS) auf
          Datenbankebene.
        </li>
        <li>
          <strong>Trennungskontrolle:</strong> Logische Trennung der Daten
          verschiedener Verantwortlicher durch Workspace-ID-Scoping in
          allen Datenbank-Abfragen plus RLS-Policies.
        </li>
        <li>
          <strong>Verschlüsselung:</strong> TLS 1.2+ bei Datenübertragung;
          Encryption at Rest auf Datenbankebene (Supabase: AES-256) sowie
          auf Speicherebene (Supabase Storage: AES-256).
        </li>
      </Ul>

      <H3>2. Integrität</H3>
      <Ul>
        <li>
          Audit-Logging aller datenschutzrelevanten Aktionen (Account-
          Löschung, Daten-Export, Checkout-Consent, Kündigung) in
          dedizierten Tabellen mit IP-Adresse und User-Agent.
        </li>
        <li>Schutz vor unbefugter Veränderung durch das Berechtigungskonzept.</li>
      </Ul>

      <H3>3. Verfügbarkeit und Belastbarkeit</H3>
      <Ul>
        <li>
          Automatisierte Backups durch den Datenbankanbieter (Supabase:
          tägliche Backups, Aufbewahrung 7 Tage im Pro-Plan;
          Point-in-Time-Recovery innerhalb von 24 Stunden).
        </li>
        <li>
          DDoS-Schutz auf Layer 3/4/7 sowie Edge-Netzwerk durch Vercel
          (Vercel Firewall).
        </li>
        <li>
          Maßnahmen zur raschen Wiederherstellung nach physischem oder
          technischem Zwischenfall durch die zugrundeliegenden
          Cloud-Plattformen (Art. 32 Abs. 1 lit. c DSGVO).
        </li>
      </Ul>

      <H3>4. Verfahren zur regelmäßigen Überprüfung</H3>
      <Ul>
        <li>Jährliche Überprüfung der TOM und Aktualisierung dieses AVV.</li>
        <li>
          Vertragliche Bindung der Unterauftragsverarbeiter über deren DPAs
          (Vercel DPA, Supabase DPA, Stripe DPA) mit Back-to-Back-Pflichten.
        </li>
        <li>Incident-Response-Verfahren für Datenschutzvorfälle.</li>
      </Ul>

      <H2>Anlage 3 — Genehmigte Unterauftragsverarbeiter</H2>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-neutral-300 dark:border-neutral-700">
              <Th>Unterauftragsverarbeiter</Th>
              <Th>Leistung</Th>
              <Th>Sitz / Verarbeitungsort</Th>
              <Th>Transfermechanismus</Th>
            </tr>
          </thead>
          <tbody>
            <SubRow
              name="Vercel Inc."
              service="Hosting, Serverless-Functions, CDN"
              location="Sitz USA / Verarbeitung Frankfurt (fra1)"
              transfer="DPF-Zertifizierung + SCCs"
            />
            <SubRow
              name="Supabase Inc."
              service="Datenbank, Authentifizierung, Speicher"
              location="Sitz USA / Verarbeitung Paris (eu-west-3)"
              transfer="DPF-Zertifizierung + SCCs"
            />
            <SubRow
              name="Stripe Payments Europe Ltd."
              service="Zahlungsabwicklung"
              location="Dublin, Irland (EU) + USA für globale Abwicklung"
              transfer="Stripe DPA + SCCs (Stripe DPA-Portal)"
            />
            <SubRow
              name="united-domains AG"
              service="Domain, E-Mail-Postfach"
              location="Starnberg, Deutschland (EU)"
              transfer="kein Drittlandtransfer"
            />
            <SubRow
              name="GitHub Inc."
              service="Quellcode-Verwaltung"
              location="Sitz USA"
              transfer="DPF + SCCs; keine Endkunden-PII"
            />
          </tbody>
        </table>
      </div>

      <hr className="my-12 border-neutral-200 dark:border-neutral-800" />
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Stand: 07.06.2026 · Version: 1.0 · Auftragnehmer: Patrick Hümmer
        Max Strobel GbR
      </p>
    </article>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 text-xl font-semibold tracking-tight">{children}</h2>
  );
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-6 text-base font-semibold">{children}</h3>;
}
function P({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`mt-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 ${
        className ?? ""
      }`}
    >
      {children}
    </p>
  );
}
function Ul({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 list-disc pl-5">
      {children}
    </ul>
  );
}
function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-3 py-2 align-top text-neutral-700 dark:text-neutral-300">
      {children}
    </td>
  );
}
function SubRow({
  name,
  service,
  location,
  transfer,
}: {
  name: string;
  service: string;
  location: string;
  transfer: string;
}) {
  return (
    <tr className="border-b border-neutral-200 dark:border-neutral-800">
      <Td>
        <strong>{name}</strong>
      </Td>
      <Td>{service}</Td>
      <Td>{location}</Td>
      <Td>{transfer}</Td>
    </tr>
  );
}
