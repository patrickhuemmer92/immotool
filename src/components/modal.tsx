"use client";

import { useEffect } from "react";

/**
 * Generisches Modal-Shell — Backdrop + zentrierter Card + Escape-to-close.
 *
 * Bewusst dünn: kein eingebauter Header / Footer, weil verschiedene Modals
 * unterschiedliche Layouts brauchen. Sub-Komponenten ModalHeader/ModalFooter
 * unten dürfen, müssen aber nicht verwendet werden.
 *
 * Wird genutzt von:
 *   - InlinePropertyDialog (Portfolio → "+ Neues Objekt")
 *   - InlineLoanDialog (Property → "+ Darlehen")
 *   - DeletePropertyButton (Refactor folgt evtl. später)
 */
export function Modal({
  open,
  onClose,
  children,
  size = "md",
  closeOnBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** max-width des Card. md = max-w-xl, lg = max-w-2xl, xl = max-w-4xl. */
  size?: "sm" | "md" | "lg" | "xl";
  closeOnBackdrop?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const sizeClass = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  }[size];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl w-full ${sizeClass} max-h-[90vh] overflow-y-auto`}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle?: string;
  onClose?: () => void;
}) {
  return (
    <div className="px-6 pt-5 pb-4 border-b border-neutral-200 dark:border-neutral-800 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h3 className="text-lg font-semibold truncate">{title}</h3>
        {subtitle && (
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {subtitle}
          </p>
        )}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 text-xl leading-none"
        >
          ×
        </button>
      )}
    </div>
  );
}

export function ModalBody({ children }: { children: React.ReactNode }) {
  return <div className="px-6 py-5">{children}</div>;
}

export function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-2">
      {children}
    </div>
  );
}
