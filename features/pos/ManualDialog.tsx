"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { money } from "@/lib/domain";

import type { AppState } from "@/features/workspace/use-workspace";

export default function ManualDialog({ s }: { s: AppState }) {
  return (
    <Dialog
      open={!!s.manual}
      onOpenChange={(v) => {
        if (!v) s.setManual(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{s.manual?.product.name}</DialogTitle>
          <DialogDescription>
            Este código identifica el producto. Introduce el importe impreso en
            la etiqueta.
          </DialogDescription>
        </DialogHeader>
        <label className="field">
          Importe total de la etiqueta (Bs)
          <input
            autoFocus
            inputMode="decimal"
            value={s.amount}
            onChange={(e) => s.setAmount(e.target.value)}
            placeholder="16,90"
          />
        </label>
        <label className="field">
          Peso de la etiqueta en kg (opcional)
          <input
            inputMode="decimal"
            value={s.weight}
            onChange={(e) => s.setWeight(e.target.value)}
            placeholder="0,260"
          />
        </label>
        <p className="hint">
          Precio de referencia: {s.manual && money(s.manual.product.price)}/kg.
          Se cobra el importe que introduces.
        </p>
        <button className="primary" onClick={s.addManual}>
          Añadir a la venta
        </button>
      </DialogContent>
    </Dialog>
  );
}
