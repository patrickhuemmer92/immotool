/**
 * German-locale formatters and parsers. Centralize so that switching locales
 * later (or fixing a bug) touches one file instead of fifty.
 *
 * Convention:
 *   - Percentages are stored as decimals (0..1) in the DB but displayed and
 *     entered as 1..100 (e.g. "2,5" for 2.5 %).
 *   - Currency is hard-coded EUR for now; settings.default_currency exists
 *     in the schema but is not user-facing yet.
 *   - Dates from Postgres come as ISO yyyy-MM-dd strings; we render TT.MM.JJJJ.
 */

const NUM_LOCALE = "de-DE";

export function eur(
  n: number | null | undefined,
  opts: Intl.NumberFormatOptions = {}
): string {
  if (n === null || n === undefined || !Number.isFinite(n as number)) return "—";
  return (n as number).toLocaleString(NUM_LOCALE, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
    ...opts,
  });
}

export function eurExact(n: number | null | undefined): string {
  return eur(n, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

export function num(
  n: number | null | undefined,
  opts: Intl.NumberFormatOptions = {}
): string {
  if (n === null || n === undefined || !Number.isFinite(n as number)) return "—";
  return (n as number).toLocaleString(NUM_LOCALE, {
    maximumFractionDigits: 2,
    ...opts,
  });
}

/** Render a decimal (0.02) as a German percent string ("2,00 %"). */
export function pct(
  decimal: number | null | undefined,
  opts: Intl.NumberFormatOptions = {}
): string {
  if (
    decimal === null ||
    decimal === undefined ||
    !Number.isFinite(decimal as number)
  )
    return "—";
  return (decimal as number).toLocaleString(NUM_LOCALE, {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...opts,
  });
}

/** Format an ISO date string (yyyy-MM-dd) or Date object as TT.MM.JJJJ. */
export function dateDe(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(NUM_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// --------------------------------------------------------------------------
// Parsers — used by zod transforms so users can type "1.234,56", "1234.56",
// "2,5" or "2.5" and all work.
// --------------------------------------------------------------------------

/** Parse a German or English-style number. Returns null for empty/invalid. */
export function parseDecimal(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  // Strip currency / percent symbols and whitespace.
  let s = trimmed.replace(/[\s€%]/g, "");

  const dotCount = (s.match(/\./g) ?? []).length;
  const commaCount = (s.match(/,/g) ?? []).length;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");

  if (dotCount > 0 && commaCount > 0) {
    // Both present — the later one is the decimal separator.
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (commaCount > 0) {
    // Only comma: treat as German decimal separator.
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (dotCount > 1) {
    // Multiple dots, no comma → all thousand separators ("1.234.567").
    s = s.replace(/\./g, "");
  } else if (dotCount === 1) {
    // Single dot, no comma — disambiguate German thousand separator vs. decimal.
    // "90.000" / "1.500" → thousand. "0.5" / "1.5" / "22.5" / "0.123" → decimal.
    const beforeStr = s.slice(0, lastDot);
    const afterStr = s.slice(lastDot + 1);
    const looksLikeThousand =
      afterStr.length === 3 &&
      beforeStr.length >= 1 &&
      beforeStr.length <= 3 &&
      beforeStr !== "0";
    if (looksLikeThousand) {
      s = s.replace(".", "");
    }
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a percent input (1..100 style, "2,5" or "2.5") and convert to
 * decimal (0.025). Returns null for empty/invalid.
 */
export function parsePercent(raw: string | null | undefined): number | null {
  const n = parseDecimal(raw);
  if (n === null) return null;
  return n / 100;
}

/**
 * Render a stored decimal (0.025) back to the percent-input string ("2,5")
 * for prefilling form inputs. Strips trailing zeros for cleanliness.
 */
export function decimalToPercentInput(
  decimal: number | null | undefined
): string {
  if (
    decimal === null ||
    decimal === undefined ||
    !Number.isFinite(decimal as number)
  )
    return "";
  return ((decimal as number) * 100).toLocaleString(NUM_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

/** Render a stored decimal (1234.56) back to a German input string. */
export function decimalToNumInput(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n as number)) return "";
  return (n as number).toLocaleString(NUM_LOCALE, {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}
