/**
 * Impressum nach § 5 TMG / § 5 DDG + § 55 Abs. 2 RStV — Stand 07.06.2026
 */
export default function ImpressumPage() {
  return (
    <article className="prose dark:prose-invert max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight mb-2">Impressum</h1>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-8">
        Stand: 07.06.2026
      </p>

      <H2>Kontaktdaten</H2>
      <div className="mt-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-4 text-sm leading-relaxed">
        <strong>Patrick Hümmer Max Strobel GbR</strong>
        <br />
        Landsberger Straße 440a
        <br />
        81241 München
        <br />
        Deutschland
        <br />
        E-Mail:{" "}
        <a
          href="mailto:info@estateably.de"
          className="text-accent hover:underline"
        >
          info@estateably.de
        </a>
      </div>

      <P>Geschäftsführer: Patrick Hümmer und Max Strobel</P>

      <H2>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</H2>
      <P>Patrick Hümmer, Max Strobel</P>
      <P className="text-xs">Landsberger Straße 440a, 81241 München</P>

      <H2>Online-Streitbeilegung</H2>
      <P>
        Online-Streitbeilegung gemäß Art. 14 Abs. 1 ODR-VO: Die Europäische
        Kommission stellt eine Plattform zur Online-Streitbeilegung (OS)
        bereit, die du unter{" "}
        <a
          href="https://ec.europa.eu/consumers/odr/"
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:underline"
        >
          ec.europa.eu/consumers/odr/
        </a>{" "}
        findest.
      </P>
      <P className="text-sm">
        Wir sind nicht bereit oder verpflichtet, an einem
        Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
        teilzunehmen (§ 36 VSBG).
      </P>

      <H2>Haftungsausschluss</H2>

      <H3>Haftung für Inhalte</H3>
      <P>
        Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt.
        Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte
        können wir jedoch keine Gewähr übernehmen. Als Diensteanbieter
        sind wir für eigene Inhalte auf diesen Seiten nach den allgemeinen
        Gesetzen verantwortlich. Als Diensteanbieter sind wir jedoch nicht
        verpflichtet, übermittelte oder gespeicherte fremde Informationen
        zu überwachen oder nach Umständen zu forschen, die auf eine
        rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung
        oder Sperrung der Nutzung von Informationen nach den allgemeinen
        Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung
        ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten
        Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden
        Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
      </P>

      <H3>Haftung für Links</H3>
      <P>
        Unser Angebot enthält Links zu externen Webseiten Dritter, auf
        deren Inhalte wir keinen Einfluss haben. Deshalb können wir für
        diese fremden Inhalte auch keine Gewähr übernehmen. Für die
        Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter
        oder Betreiber der Seiten verantwortlich. Die verlinkten Seiten
        wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße
        überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der
        Verlinkung nicht erkennbar. Eine permanente inhaltliche Kontrolle
        der verlinkten Seiten ist jedoch ohne konkrete Anhaltspunkte einer
        Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von
        Rechtsverletzungen werden wir derartige Links umgehend entfernen.
      </P>

      <H3>Urheberrecht</H3>
      <P>
        Die durch die Seitenbetreiber erstellten Inhalte und Werke auf
        diesen Seiten unterliegen dem deutschen Urheberrecht. Die
        Vervielfältigung, Bearbeitung, Verbreitung und jede Art der
        Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der
        schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
        Downloads und Kopien dieser Seite sind nur für den privaten,
        nicht kommerziellen Gebrauch gestattet. Soweit die Inhalte auf
        dieser Seite nicht vom Betreiber erstellt wurden, werden die
        Urheberrechte Dritter beachtet. Insbesondere werden Inhalte
        Dritter als solche gekennzeichnet. Sollten Sie trotzdem auf eine
        Urheberrechtsverletzung aufmerksam werden, bitten wir um einen
        entsprechenden Hinweis. Bei Bekanntwerden von Rechtsverletzungen
        werden wir derartige Inhalte umgehend entfernen.
      </P>

      <hr className="my-12 border-neutral-200 dark:border-neutral-800" />
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Stand: 07.06.2026 · Anbieter: Patrick Hümmer Max Strobel GbR
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
