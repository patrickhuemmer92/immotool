"use client";

import { useState, useTransition } from "react";

/**
 * § 312k BGB — Bestätigungsformular für die Kündigung:
 *   - Kündigungsart (ordentlich / fristlos aus wichtigem Grund)
 *   - Optionaler Kündigungstermin (sonst nächstmöglich)
 *   - Optionaler Grund / Anmerkung
 *   - Schaltfläche "Jetzt kündigen" als finale Bestätigung
 */
export function CancelClient({
  workspaceId,
  subscribedQuantity,
}: {
  workspaceId: string;
  subscribedQuantity: number;
}) {
  const [kind, setKind] = useState<"ordentlich" | "fristlos">("ordentlich");
  const [requestedDate, setRequestedDate] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [confirmed, setConfirmed] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function onSubmit() {
    setError(null);
    setSuccess(null);
    if (!confirmed) {
      setError("Bitte bestätigen Sie die Kündigung mit der Checkbox.");
      return;
    }
    start(async () => {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          kind,
          requested_date: requestedDate || null,
          reason: reason || null,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Unbekannter Fehler.");
        return;
      }
      setSuccess(
        "Ihre Kündigung wurde übermittelt. Sie erhalten eine Bestätigung " +
          "per E-Mail. Bis zum Ende der laufenden Abrechnungsperiode haben Sie " +
          "weiterhin vollen Zugriff."
      );
    });
  }

  if (success) {
    return (
      <div className="mt-6 rounded-2xl border border-emerald-300 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 p-5">
        <h2 className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
          Kündigung übermittelt
        </h2>
        <p className="mt-2 text-sm text-neutral-800 dark:text-neutral-200">
          {success}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-5">
      <div>
        <h2 className="text-base font-semibold">Vertragsdetails</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Aktuelles Abo: {subscribedQuantity} Objekt
          {subscribedQuantity === 1 ? "" : "e"}.
        </p>
      </div>

      <div>
        <label className="text-sm font-medium block mb-2">Kündigungsart</label>
        <div className="flex flex-wrap gap-2">
          <Choice
            active={kind === "ordentlich"}
            onClick={() => setKind("ordentlich")}
            label="Ordentliche Kündigung"
          />
          <Choice
            active={kind === "fristlos"}
            onClick={() => setKind("fristlos")}
            label="Fristlose Kündigung aus wichtigem Grund"
          />
        </div>
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400 leading-snug">
          {kind === "ordentlich"
            ? "Wirksam zum Ende der laufenden Abrechnungsperiode bzw. zum frühestmöglichen Termin gemäß AGB § 5."
            : "Wirksam sofort. Bitte beschreiben Sie den wichtigen Grund unten."}
        </p>
      </div>

      <div>
        <label
          htmlFor="cancel-date"
          className="text-sm font-medium block mb-1"
        >
          Wunsch-Kündigungstermin (optional)
        </label>
        <input
          id="cancel-date"
          type="date"
          value={requestedDate}
          onChange={(e) => setRequestedDate(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Frei lassen für den nächstmöglichen Termin gemäß AGB.
        </p>
      </div>

      <div>
        <label
          htmlFor="cancel-reason"
          className="text-sm font-medium block mb-1"
        >
          {kind === "fristlos"
            ? "Begründung (Pflichtfeld bei fristloser Kündigung)"
            : "Anmerkung (optional)"}
        </label>
        <textarea
          id="cancel-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required={kind === "fristlos"}
          className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
        />
      </div>

      <label className="flex items-start gap-2.5 text-xs leading-relaxed cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
        />
        <span>
          Ich bestätige hiermit verbindlich die Kündigung meines
          EstateAbly-Vertrags. Mir ist bekannt, dass ich nach Ablauf der
          Kündigungsfrist die Premium-Features nicht mehr nutzen kann.
        </span>
      </label>

      <div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={
            pending || !confirmed || (kind === "fristlos" && !reason.trim())
          }
          className="rounded-lg bg-red-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Wird übermittelt …" : "Jetzt kündigen"}
        </button>
        <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
          Mit Klick auf diesen Button geben Sie eine verbindliche
          Kündigungserklärung gem. § 312k BGB ab.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

function Choice({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-lg px-3 py-1.5 text-sm border transition-colors " +
        (active
          ? "bg-accent text-accent-foreground border-transparent"
          : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800")
      }
    >
      {label}
    </button>
  );
}
