"use client";

import { useEffect, useState } from "react";
import { parseDecimal } from "@/lib/format";

/**
 * Percent input — user types "2,5" for 2.5 %. Renders a "%" suffix.
 * Stores the raw text in the form value; the server-side schema converts
 * to a 0..1 decimal.
 */
export function PercentInput({
  id,
  name,
  defaultValue,
  disabled,
  onValueChange,
  min = 0,
  max = 100,
}: {
  id?: string;
  name: string;
  defaultValue?: string;
  disabled?: boolean;
  onValueChange?: (value: number | null) => void;
  min?: number;
  max?: number;
}) {
  const [buffer, setBuffer] = useState<string>(() => defaultValue ?? "");

  useEffect(() => {
    onValueChange?.(parseDecimal(buffer));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setBuffer(e.target.value);
    onValueChange?.(parseDecimal(e.target.value));
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
        disabled={disabled}
        min={min}
        max={max}
        className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent pl-3 pr-7 py-2 text-sm outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-neutral-500 dark:text-neutral-400"
      >
        %
      </span>
    </div>
  );
}
