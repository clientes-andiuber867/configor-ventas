"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { AppState } from "@/features/workspace/use-workspace";

export default function VoidDialog({ s }: { s: AppState }) {
  return (
    <Dialog
      open={!!s.voidSale}
      onOpenChange={(v) => {
        if (!v) s.setVoidSale(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anular venta</DialogTitle>
          <DialogDescription>
            Se conservará en el historial y dejará de sumar en el resumen. No
            realiza una devolución bancaria.
          </DialogDescription>
        </DialogHeader>
        <label className="field">
          Motivo
          <input
            value={s.reason}
            onChange={(e) => s.setReason(e.target.value)}
            placeholder="Describe el motivo (mínimo 5 caracteres)"
          />
        </label>
        <button
          disabled={s.busy || s.reason.trim().length < 5}
          className="primary"
          onClick={async () => {
            if (
              await s.run(
                { action: "void", id: s.voidSale?.id, reason: s.reason },
                "Venta anulada",
              )
            )
              s.setVoidSale(null);
          }}
        >
          Confirmar anulación
        </button>
      </DialogContent>
    </Dialog>
  );
}
