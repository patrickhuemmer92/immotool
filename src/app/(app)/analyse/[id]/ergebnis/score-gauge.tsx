/**
 * Klassischer Tacho: Halbkreis von 0 bis 100 mit einer Nadel, die auf
 * den Score-Wert zeigt. Rein visuelle Komponente (SVG), kein Client-
 * State — kann direkt in einer Server-Component gerendert werden.
 *
 * Farb-Abschnitte:
 *   0-39   rot     (kritisch)
 *   40-64  gelb    (aufmerksam)
 *   65-100 grün    (unauffällig)
 */

export function ScoreGauge({
  value,
  size = 220,
}: {
  value: number | null;
  size?: number;
}) {
  const v = value == null ? 0 : Math.max(0, Math.min(100, value));

  // Viewbox: 200 breit, 130 hoch. Halbkreis-Mittelpunkt bei (100, 100).
  // Radius 80. Winkel: −180° (links) bis 0° (rechts) — mapping 0..100
  // linear auf −180° … 0°.
  const cx = 100;
  const cy = 100;
  const rOuter = 80;
  const rInner = 60;

  const angleDeg = -180 + (v / 100) * 180;
  const angleRad = (angleDeg * Math.PI) / 180;

  // Bögen für die drei Farbabschnitte (rot / gelb / grün).
  const arc = (fromPct: number, toPct: number) =>
    arcPath(cx, cy, rOuter, rInner, fromPct, toPct);

  // Nadelspitze berechnen — vom Mittelpunkt aus.
  const needleLen = rOuter + 6;
  const needleX = cx + Math.cos(angleRad) * needleLen;
  const needleY = cy + Math.sin(angleRad) * needleLen;

  const valueColor =
    v >= 65
      ? "#059669"
      : v >= 40
        ? "#D97706"
        : v > 0
          ? "#DC2626"
          : "#9CA3AF";

  return (
    <svg
      viewBox="0 0 200 130"
      style={{ width: size, height: (size * 130) / 200 }}
      aria-label={`Score ${v} von 100`}
    >
      {/* Farb-Segmente */}
      <path d={arc(0, 40)} fill="#DC2626" opacity={0.85} />
      <path d={arc(40, 65)} fill="#D97706" opacity={0.85} />
      <path d={arc(65, 100)} fill="#059669" opacity={0.85} />

      {/* Skala-Ticks bei 0, 25, 50, 75, 100 */}
      {[0, 25, 50, 75, 100].map((pct) => {
        const a = -180 + (pct / 100) * 180;
        const ar = (a * Math.PI) / 180;
        const x1 = cx + Math.cos(ar) * (rInner - 4);
        const y1 = cy + Math.sin(ar) * (rInner - 4);
        const x2 = cx + Math.cos(ar) * (rOuter + 4);
        const y2 = cy + Math.sin(ar) * (rOuter + 4);
        const tx = cx + Math.cos(ar) * (rOuter + 14);
        const ty = cy + Math.sin(ar) * (rOuter + 14) + 3;
        return (
          <g key={pct}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              className="text-neutral-500 dark:text-neutral-400"
              strokeWidth={1}
            />
            <text
              x={tx}
              y={ty}
              textAnchor="middle"
              fontSize="7"
              fill="currentColor"
              className="text-neutral-500 dark:text-neutral-400"
            >
              {pct}
            </text>
          </g>
        );
      })}

      {/* Nadel */}
      <line
        x1={cx}
        y1={cy}
        x2={needleX}
        y2={needleY}
        stroke={valueColor}
        strokeWidth={3}
        strokeLinecap="round"
      />
      {/* Nadel-Basis */}
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill={valueColor}
        stroke="currentColor"
        className="text-white dark:text-neutral-900"
        strokeWidth={1.5}
      />

      {/* Wert-Anzeige unter dem Tacho */}
      <text
        x={cx}
        y={122}
        textAnchor="middle"
        fontSize="18"
        fontWeight="600"
        fill={valueColor}
      >
        {value == null ? "—" : v}
        <tspan
          fontSize="10"
          fill="currentColor"
          className="text-neutral-500 dark:text-neutral-400"
        >
          {" "}
          /100
        </tspan>
      </text>
    </svg>
  );
}

/** Halbring-Segment als Path. fromPct/toPct sind Prozentwerte 0..100. */
function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  fromPct: number,
  toPct: number
): string {
  const angFrom = ((-180 + (fromPct / 100) * 180) * Math.PI) / 180;
  const angTo = ((-180 + (toPct / 100) * 180) * Math.PI) / 180;

  const xOuterFrom = cx + Math.cos(angFrom) * rOuter;
  const yOuterFrom = cy + Math.sin(angFrom) * rOuter;
  const xOuterTo = cx + Math.cos(angTo) * rOuter;
  const yOuterTo = cy + Math.sin(angTo) * rOuter;

  const xInnerTo = cx + Math.cos(angTo) * rInner;
  const yInnerTo = cy + Math.sin(angTo) * rInner;
  const xInnerFrom = cx + Math.cos(angFrom) * rInner;
  const yInnerFrom = cy + Math.sin(angFrom) * rInner;

  // large-arc-flag = 0 (immer < 180° pro Segment). sweep = 1 im Uhrzeigersinn
  // für outer, 0 gegen für inner.
  return [
    `M ${xOuterFrom} ${yOuterFrom}`,
    `A ${rOuter} ${rOuter} 0 0 1 ${xOuterTo} ${yOuterTo}`,
    `L ${xInnerTo} ${yInnerTo}`,
    `A ${rInner} ${rInner} 0 0 0 ${xInnerFrom} ${yInnerFrom}`,
    "Z",
  ].join(" ");
}
