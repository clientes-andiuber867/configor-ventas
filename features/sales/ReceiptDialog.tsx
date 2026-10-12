"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Printer } from "lucide-react";

import { money } from "@/lib/domain";

import type { AppState } from "@/features/workspace/use-workspace";

export default function ReceiptDialog({ s }: { s: AppState }) {
  return (
    <Dialog
      open={!!s.selected}
      onOpenChange={(v) => {
        if (!v) s.setSelected(null);
      }}
    >
      <DialogContent className="receipt-dialog">
        <DialogHeader>
          <DialogTitle>Comprobante de venta</DialogTitle>
          <DialogDescription>
            Documento interno · no es factura fiscal.
          </DialogDescription>
        </DialogHeader>
        {s.selected && (
          <>
            <div id="receipt-content">
              <img
                src="/configor-logo.jpg"
                alt="CONFIGOR"
                className="receipt-logo"
              />
              <h2>CONFIGOR CARNES</h2>
              <p>Venta #{s.selected.id.slice(0, 8).toUpperCase()}</p>
              <small>
                {new Date(s.selected.created).toLocaleString("es-BO", {
                  timeZone: "America/La_Paz",
                })}
              </small>
              <p>Vendedor: {s.selected.cashier}</p>
              {s.selected.items.map((l, i) => (
                <div className="receipt-line" key={i}>
                  <span>
                    {l.name}
                    <small>
                      {l.grams === null
                        ? "Peso no registrado"
                        : (l.grams / 1000).toFixed(3) + " kg"}
                    </small>
                  </span>
                  <b>{money(l.amount)}</b>
                </div>
              ))}
              <div className="payment-row">
                <strong>TOTAL</strong>
                <strong>{money(s.selected.total)}</strong>
              </div>
              <div className="payment-row">
                <span>Efectivo</span>
                <span>{money(s.selected.cash)}</span>
              </div>
              <div className="payment-row">
                <span>QR</span>
                <span>{money(s.selected.qr)}</span>
              </div>
              {s.selected.status === "void" && (
                <p className="error-banner">
                  ANULADA: {s.selected.void_reason}
                </p>
              )}
            </div>
            <button className="primary" onClick={() => window.print()}>
              <Printer size={17} /> Imprimir comprobante
            </button>
            {s.admin && s.selected.status === "completed" && (
              <button
                className="text-button"
                onClick={() => {
                  s.setVoidSale(s.selected);
                  s.setSelected(null);
                  s.setReason("");
                }}
              >
                Anular venta
              </button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
