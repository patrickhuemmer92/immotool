import Link from "next/link";

/**
 * AGB — Stand 07.06.2026 · Version 1.0
 *
 * TODO vor Final-Veröffentlichung:
 *  - § 5: Tippfehler "Kleinunternehmerregleung" → "Kleinunternehmerregelung"
 *    und USt-Klausel korrigieren ("nicht ausgewiesen" statt "exkl.")
 *  - § 6: Anschrift + Muster-Widerrufsformular ergänzen
 *  - § 11: Schweigende-Zustimmung-Klausel rechtlich überprüfen
 *    (BGH-Urteil XI ZR 26/20)
 */
export default function AgbPage() {
  return (
    <article className="prose dark:prose-invert max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight mb-2">
        Allgemeine Geschäftsbedingungen (AGB) — EstateAbly
      </h1>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-8">
        Stand: 07.06.2026 · Version: 1.0
      </p>

      <H2>§ 1 — Geltungsbereich und Begriffsbestimmungen</H2>
      <P>
        Diese AGB gelten für alle Verträge über die Nutzung der Software-as-a-Service-Anwendung „EstateAbly" (nachfolgend „Dienst") zwischen <strong>Patrick Hümmer Max Strobel GbR</strong> und dem jeweiligen Kunden (nachfolgend „Nutzer").
      </P>
      <P>
        Verbraucher ist jede natürliche Person, die den Vertrag zu Zwecken abschließt, die überwiegend weder ihrer gewerblichen noch ihrer selbständigen beruflichen Tätigkeit zugerechnet werden können (§ 13 BGB). Unternehmer ist eine natürliche oder juristische Person oder rechtsfähige Personengesellschaft, die bei Abschluss des Vertrages in Ausübung ihrer gewerblichen oder selbständigen beruflichen Tätigkeit handelt (§ 14 BGB).
      </P>
      <P>
        Abweichende AGB des Nutzers werden nur Vertragsbestandteil, wenn der Anbieter ihrer Geltung ausdrücklich in Textform zugestimmt hat.
      </P>
      <P>Maßgeblich ist die bei Vertragsschluss gültige Fassung dieser AGB.</P>

      <H2>§ 2 — Vertragsgegenstand und Leistungsbeschreibung</H2>
      <P>
        Der Anbieter stellt dem Nutzer über das Internet die Software „EstateAbly" als webbasierte Anwendung zur Strukturierung, Pflege und Auswertung von Immobilien-Portfoliodaten sowie zur Erstellung von Auswertungen und Berichten („Factbooks") bereit. Der Funktionsumfang ergibt sich aus der zum Vertragszeitpunkt gültigen Leistungsbeschreibung unter <Link href="/einstellungen/abrechnung" className="text-accent hover:underline">https://www.estateably.de/einstellungen/abrechnung</Link>.
      </P>
      <P>Der Anbieter bietet folgende Leistungen an:</P>
      <Ul>
        <li><strong>Jahresabonnement (Abo):</strong> Zeitlich befristete Nutzung des Dienstes gegen wiederkehrendes Entgelt (§ 5).</li>
        <li><strong>Einmalkauf:</strong> Einmalige, entgeltliche Bereitstellung einer einzeln abgerufenen Leistung (z. B. Freischaltung einer Einzelfunktion) ohne wiederkehrende Zahlungspflicht.</li>
      </Ul>
      <P>Die Software wird als Standardsoftware bereitgestellt. Ein Anspruch auf individuelle Anpassungen oder über die Leistungsbeschreibung hinausgehende Funktionen besteht nicht.</P>
      <P>
        <strong>Keine Rechts-, Steuer- oder Finanzberatung.</strong> Alle durch den Dienst erzeugten Auswertungen, Berechnungen, Scorings und Berichte sind technische Hilfsmittel auf Basis der vom Nutzer eingegebenen Daten. Sie stellen keine Rechts-, Steuer-, Finanzierungs- oder Anlageberatung dar und ersetzen diese nicht.
      </P>

      <H2>§ 3 — Registrierung und Vertragsschluss</H2>
      <P>Die Nutzung setzt eine Registrierung voraus. Der Nutzer gibt wahrheitsgemäße, vollständige und aktuelle Daten an.</P>
      <P>Die Darstellung der Leistungen im Online-Auftritt stellt kein bindendes Angebot dar. Durch Anklicken des Bestell-Buttons gibt der Nutzer ein verbindliches Angebot ab.</P>
      <P>Gegenüber Verbrauchern ist der Bestell-Button gemäß § 312j Abs. 3 BGB mit „zahlungspflichtig bestellen" (oder gleichwertiger Formulierung) beschriftet.</P>
      <P>Der Vertrag kommt mit der Annahme durch den Anbieter zustande, spätestens durch Bereitstellung des Zugangs. Der Anbieter bestätigt den Bestelleingang unverzüglich in Textform.</P>
      <P>Der Vertragstext wird gespeichert und dem Nutzer spätestens nach Vertragsschluss zusammen mit diesen AGB in Textform übermittelt.</P>

      <H2>§ 4 — Pflichten des Nutzers</H2>
      <P>Der Nutzer hält seine Zugangsdaten geheim und schützt sie vor dem Zugriff Dritter.</P>
      <P>
        Der Nutzer ist für alle von ihm eingestellten Inhalte und Daten allein verantwortlich. Er sichert zu, dass er zur Verarbeitung eingestellter personenbezogener Daten Dritter (insbesondere Mieterdaten) berechtigt ist und über eine Rechtsgrundlage nach der DSGVO verfügt. Im datenschutzrechtlichen Verhältnis ist der Nutzer Verantwortlicher (Art. 4 Nr. 7 DSGVO) und der Anbieter Auftragsverarbeiter (Art. 4 Nr. 8 DSGVO); es gilt ergänzend der in die <Link href="/datenschutz" className="text-accent hover:underline">Datenschutzerklärung</Link> integrierte Auftragsverarbeitungsvertrag (AVV).
      </P>
      <P>Der Nutzer stellt den Anbieter von Ansprüchen Dritter frei, die auf einer rechtswidrigen Nutzung oder rechtswidrig eingestellten Inhalten beruhen, soweit er dies zu vertreten hat (einschließlich angemessener Rechtsverteidigungskosten). Gegenüber Verbrauchern gilt dies nur bei Verschulden des Verbrauchers.</P>
      <P>Untersagt ist die Nutzung zu rechtswidrigen Zwecken, das Einstellen rechtsverletzender Inhalte sowie jede Handlung, die Verfügbarkeit oder Integrität des Dienstes beeinträchtigt.</P>

      <H2>§ 5 — Preise, Zahlung, Laufzeit und Kündigung</H2>
      <P>
        Es gelten die bei Bestellung ausgewiesenen Preise. Endpreise; Umsatzsteuer wird gemäß § 19 UStG (Kleinunternehmerregelung) nicht ausgewiesen.
      </P>
      <P>Die Zahlung erfolgt über den Zahlungsdienstleister Stripe (Stripe Payments Europe, Ltd., Dublin, Irland). Abo-Entgelt: im Voraus je Vertragsperiode fällig. Einmalkauf-Entgelt: mit Vertragsschluss fällig.</P>
      <P><strong>Laufzeit Abo.</strong> Mindestlaufzeit: 12 Monate ab Bereitstellung.</P>
      <P><strong>Verlängerung und Kündigung — Verbraucher.</strong> Nach Ablauf der Mindestlaufzeit verlängert sich das Abo auf unbestimmte Zeit, sofern nicht mit einer Frist von einem Monat zum Ende der Mindestlaufzeit gekündigt wird. In der verlängerten Laufzeit: jederzeit mit einem Monat Frist kündbar.</P>
      <P><strong>Verlängerung und Kündigung — Unternehmer.</strong> Verlängert sich um je 12 Monate, sofern nicht mit 3 Monaten Frist zum Laufzeitende gekündigt wird.</P>
      <P><strong>Kündigungsbutton (§ 312k BGB).</strong> Verbraucher, die online abgeschlossen haben, können über die Kündigungsfunktion <Link href="/einstellungen/kuendigung" className="text-accent hover:underline">„Verträge hier kündigen"</Link> kündigen.</P>
      <P>Kündigung: Textform (E-Mail an <a href="mailto:info@estateably.de" className="text-accent hover:underline">info@estateably.de</a> oder über die Kündigungsfunktion).</P>
      <P>Einmalkauf: kein Dauerschuldverhältnis, keine Kündigung erforderlich.</P>
      <P>Außerordentliche Kündigung aus wichtigem Grund bleibt für beide Parteien unberührt.</P>

      <H2>§ 6 — Widerrufsrecht (nur Verbraucher)</H2>
      <P>Verbrauchern steht ein gesetzliches Widerrufsrecht zu. Unternehmern steht kein Widerrufsrecht zu.</P>

      <H3>Widerrufsbelehrung</H3>
      <P><strong>Widerrufsrecht.</strong> Sie haben das Recht, binnen 14 Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Frist beträgt 14 Tage ab dem Tag des Vertragsabschlusses.</P>
      <P>
        Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (<strong>Patrick Hümmer Max Strobel GbR, [Anschrift bitte ergänzen], info@estateably.de</strong>) mittels einer eindeutigen Erklärung (z. B. Brief oder E-Mail) über Ihren Entschluss informieren. Sie können das <a href="/legal/muster-widerruf.pdf" className="text-accent hover:underline">beigefügte Muster-Widerrufsformular</a> verwenden. Zur Wahrung der Frist reicht die rechtzeitige Absendung.
      </P>
      <P><strong>Folgen des Widerrufs.</strong> Wir erstatten alle erhaltenen Zahlungen unverzüglich, spätestens binnen 14 Tagen ab Zugang Ihrer Widerrufserklärung, mit demselben Zahlungsmittel; Entgelte werden nicht berechnet.</P>
      <P><strong>Wertersatz bei Dienstleistungen.</strong> Haben Sie verlangt, dass die Dienstleistung während der Widerrufsfrist beginnt, zahlen Sie einen angemessenen Betrag entsprechend dem Anteil der bereits erbrachten Leistung.</P>
      <P>
        <strong>Vorzeitiges Erlöschen.</strong>
      </P>
      <Ul>
        <li><strong>Dienstleistung (Abo):</strong> Das Widerrufsrecht erlischt bei vollständiger Erbringung, wenn die Ausführung erst nach ausdrücklicher Zustimmung und Kenntnisnahme des Verlusts des Widerrufsrechts begonnen hat.</li>
        <li><strong>Digitaler Inhalt (Einmalkauf):</strong> Das Widerrufsrecht erlischt, wenn die Ausführung begonnen hat, nachdem Sie (1) ausdrücklich zugestimmt haben, dass wir vor Fristablauf beginnen, (2) Ihre Kenntnis vom Verlust des Widerrufsrechts bestätigt haben und (3) wir eine Bestätigung übermittelt haben.</li>
      </Ul>

      <H2>§ 7 — Verfügbarkeit und Mitwirkung</H2>
      <P>Der Anbieter strebt eine sehr hohe Verfügbarkeit im Jahresmittel an, gemessen am Übergabepunkt des Rechenzentrums. Dies ist ein Zielwert, keine Garantie.</P>
      <P>Nicht eingerechnet: angekündigte Wartungsfenster, höhere Gewalt, Störungen bei Subunternehmern.</P>
      <P>Wartungsarbeiten werden nach Möglichkeit vorab angekündigt und in nutzungsarmen Zeiten durchgeführt.</P>
      <P>Der Nutzer ist gehalten, seine Daten regelmäßig zu exportieren und eigene Sicherungskopien anzufertigen. Die Sicherungsroutinen des Anbieters bleiben unberührt.</P>

      <H2>§ 8 — Datenschutz und Auftragsverarbeitung</H2>
      <P>Der Anbieter verarbeitet personenbezogene Daten des Nutzers (als Verantwortlicher) nach Maßgabe der <Link href="/datenschutz" className="text-accent hover:underline">Datenschutzerklärung</Link>.</P>
      <P>Soweit der Anbieter im Auftrag des Nutzers personenbezogene Daten Dritter (insbesondere Mieterdaten) verarbeitet, gilt der in die Datenschutzerklärung integrierte Auftragsverarbeitungsvertrag (AVV) nach Art. 28 DSGVO.</P>

      <H2>§ 9 — Nutzungsrechte und geistiges Eigentum</H2>
      <P>Der Nutzer erhält für die Vertragslaufzeit ein einfaches, nicht übertragbares, nicht unterlizenzierbares Recht zur Nutzung des Dienstes im Rahmen des Vertrages.</P>
      <P>Alle Rechte an der Software, einschließlich Marken, Design und Dokumentation, verbleiben beim Anbieter.</P>
      <P>Die vom Nutzer eingestellten Inhalte und Daten bleiben dessen geistiges Eigentum. Der Anbieter erhält daran nur die zur Vertragserfüllung erforderlichen Nutzungsrechte.</P>

      <H2>§ 10 — Gewährleistung und Haftung</H2>
      <P>Es gelten die gesetzlichen Mängelrechte. Bei dauerhafter Bereitstellung der Software gelten gegenüber Verbrauchern ergänzend die §§ 327 ff. BGB.</P>
      <P>Unbeschränkte Haftung besteht für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit; bei Vorsatz und grober Fahrlässigkeit; bei arglistig verschwiegenen Mängeln; im Rahmen einer übernommenen Garantie; nach dem Produkthaftungsgesetz.</P>
      <P>Bei einfacher Fahrlässigkeit haftet der Anbieter nur bei Verletzung wesentlicher Vertragspflichten (Kardinalpflichten), begrenzt auf den vertragstypischen, vorhersehbaren Schaden.</P>
      <P>Im Übrigen ist die Haftung ausgeschlossen.</P>
      <P>Die Beschränkungen gelten auch für gesetzliche Vertreter, Mitarbeiter und Erfüllungsgehilfen.</P>
      <P><strong>Datenverlust.</strong> Haftung nur in dem Umfang, in dem der Schaden auch bei ordnungsgemäßer Datensicherung durch den Nutzer eingetreten wäre.</P>

      <H2>§ 11 — Änderungen der AGB</H2>
      <P>Änderungen aus triftigem Grund (Rechtsänderung, Rechtsprechung, technische Weiterentwicklung) werden dem Nutzer mindestens 6 Wochen vor Inkrafttreten in Textform mitgeteilt. Der Nutzer wird auf sein Widerspruchsrecht, die Frist und die Rechtsfolge des Schweigens hingewiesen.</P>
      <P>Widerspricht der Nutzer nicht innerhalb von 6 Wochen, gelten die Änderungen als angenommen. Bei Widerspruch sind beide Parteien zur ordentlichen Kündigung des Vertrags zum Inkrafttreten der Änderung berechtigt.</P>

      <H2>§ 12 — Schlussbestimmungen</H2>
      <P>Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Bei Verbrauchern bleibt der zwingende Schutz des Aufenthaltsstaates unberührt.</P>
      <P>Gerichtsstand für Unternehmer und juristische Personen des öffentlichen Rechts: Sitz des Anbieters. Dies gilt nicht gegenüber Verbrauchern.</P>
      <P><strong>Verbraucherstreitbeilegung.</strong> Der Anbieter ist zur Teilnahme an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle weder verpflichtet noch bereit (§ 36 VSBG).</P>
      <P>Wird eine Bestimmung unwirksam, bleiben die übrigen wirksam; es gelten die gesetzlichen Vorschriften (§ 306 BGB).</P>
      <P>Änderungen und Ergänzungen: Textform.</P>

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
