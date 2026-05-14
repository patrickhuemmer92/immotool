"use client";

import { useEffect, useState } from "react";
import { parseDecimal } from "@/lib/format";

/**
 * Currency-aware text input.
 *
 * Why not <input type="number">? Because we want German formatting
 * ("1.234,56 €") on blur, a euro suffix inside the field, and the ability
 * to surface a "live" parsed value to a parent for sums and validation.
 *
 * The input is uncontrolled wrt. its raw string ("buffer"), but we publish
 * the parsed number to the parent via onValueChange. The hidden value
 * propagated through form submission is the raw text (already accepted by
 * `parseDecimal` on the server-side).
 */
export function MoneyInput({
  id,
  name,
  defaultValue,
  disabled,
  onValueChange,
  placeholder,
}: {
  id?: string;
  name: string;
  defaultValue?: string;
  disabled?: boolean;
  onValueChange?: (value: number | null) => void;
  placeholder?: string;
}) {
  const [buffer, setBuffer] = useState<string>(() => formatInitial(defaultValue));

  // Publish initial value once on mount.
  useEffect(() => {
    onValueChange?.(parseDecimal(buffer));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setBuffer(e.target.value);
    onValueChange?.(parseDecimal(e.target.value));
  }

  function handleBlur() {
    const n = parseDecimal(buffer);
    if (n === null) return;
    setBuffer(formatEuroNumber(n));
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    // Strip the formatting so editing feels natural.
    const n = parseDecimal(buffer);
    if (n !== null) {
      setBuffer(n.toLocaleString("de-DE", { useGrouping: false, maximumFractionDigits: 2 }));
      requestAnimationFrame(() => e.target.select());
    }
  }

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        value={buffer}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent pl-3 pr-7 py-2 text-sm outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-neutral-500 dark:text-neutral-400"
      >
        €
      </span>
    </div>
  );
}

function formatInitial(raw: string | undefined): string {
  if (!raw) return "";
  const n = parseDecimal(raw);
  if (n === null) return raw;
  return formatEuroNumber(n);
}

function formatEuroNumber(n: number): string {
  return n.toLocaleString("de-DE", {
    useGrouping: true,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
