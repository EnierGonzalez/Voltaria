"use client";

import { X } from "lucide-react";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  onClose
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/74 p-4 backdrop-blur sm:items-center">
      <div className="w-full max-w-sm rounded-lg border border-border bg-panel p-4 shadow-premium">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <p className="mt-2 text-sm text-muted">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-panel2 text-muted transition hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-md border border-border bg-panel2 px-3 text-sm font-medium text-muted transition hover:text-foreground"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-10 rounded-md border border-danger/40 bg-danger/15 px-3 text-sm font-semibold text-danger transition hover:bg-danger/20"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
