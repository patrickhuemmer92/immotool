import type { CapitalStack as CapitalStackData } from "@/lib/dashboard/types";
import { formatEuro } from "@/lib/dashboard/format";

/**
 * Hero-Kapitalstapel: eine horizontale Balken-Bar zeigt
 * Restschuld (Slate) + Eigenkapital (Brand-Teal) = Marktwert. Über
 * der Bar markiert ein Tick die Anschaffungs-Investition — so sieht
 * man auf einen Blick: was war's Investment, wie ist's heute aufgeteilt
 * und wie weit ist der Marktwert vorgelaufen.
 */
export function DashboardCapitalStack({
  stack,
}: {
  stack: CapitalStackData;
}) {
  const total = stack.marketValue;
  if (total <= 0) return null;

  const debtPct = clamp((stack.debt / total) * 100, 0, 100);
  const equityPct = clamp(100 - debtPct, 0, 100);
  // Tick darf auch über die Bar hinausragen — Marktwert kann unter der
  // Anschaffung liegen (z. B. nach Korrektur). Wir clampen NICHT, der
  // Marker bleibt am Ende kleben und signalisiert "Verlustzone".
  const acquisitionPct = total > 0 ? (stack.acquisition / total) * 100 : 0;

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,27,46,0.04)]">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">
          Kapitalstruktur des Portfolios
        </h2>
        <div className="text-xs text-neutral-500">
          Marktwert {formatEuro(total)} · Stand heute
        </div>
      </div>

      <div className="relative mt-4 h-8 rounded-lg overflow-hidden bg-neutral-100">
        <div
          className="h-full bg-neutral-300"
          style={{ width: `${debtPct}%`, float: "left" }}
        />
        <div
          className="h-full bg-accent"
          style={{ width: `${equityPct}%`, float: "left" }}
        />
        {/* Anschaffungs-Tick — relativ zur Bar positioniert, ragt
            ein paar Pixel oben/unten heraus, damit er nicht in den
            Farbflächen verschwindet. */}
        {acquisitionPct > 0 && acquisitionPct <= 100 ? (
          <div
            className="absolute -top-1 -bottom-1 w-[2px] bg-neutral-900"
            style={{ left: `calc(${acquisitionPct}% - 1px)` }}
            title={`Anschaffung ${formatEuro(stack.acquisition)}`}
          >
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-neutral-900" />
          </div>
        ) : null}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] text-neutral-600">
        <li className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-[3px] bg-neutral-300" />
          Restschuld · {formatEuro(stack.debt)}
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-[3px] bg-accent" />
          Eigenkapital · {formatEuro(stack.equity)}
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block h-3 w-[2px] bg-neutral-900" />
          Anschaffung · {formatEuro(stack.acquisition)}
        </li>
      </ul>
    </section>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
