/**
 * Format-Helfer fürs Dashboard. Bewusst klein gehalten — die Charts
 * brauchen verschiedene Detailgrade (M €, T €, volles €), je nach
 * Größenordnung der Achsen.
 */

const eurFull = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const numberDe = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 0,
});

export function formatEuro(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return eurFull.format(value);
}

/** Kompakter Achsen-Format: 12.000 → "12 T€", 1.200.000 → "1,2 M€". */
export function formatEurAxis(value: number): string {
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("de-DE", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} M€`;
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toLocaleString("de-DE", {
      maximumFractionDigits: 0,
    })} T€`;
  }
  return `${numberDe.format(value)} €`;
}

/** Marktwert-Anzeige in der KPI: 2.840.000 → "2,84 M €". */
export function formatEuroMillionsKpi(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} M €`;
  }
  if (Math.abs(value) >= 10_000) {
    return `${(value / 1_000).toLocaleString("de-DE", {
      maximumFractionDigits: 0,
    })} T €`;
  }
  return formatEuro(value);
}

export function formatPercent(
  value: number | null | undefined,
  fractionDigits = 1
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("de-DE", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })} %`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return numberDe.format(value);
}
