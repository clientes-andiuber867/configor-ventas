"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Checkbox } from "@/components/ui/checkbox";

import { useEffect, useState } from "react";

import { ArrowLeft, Maximize2 } from "lucide-react";

import { Choice } from "@/components/shared/tables";

import { money } from "@/lib/domain";

import type { AppState } from "@/features/workspace/use-workspace";

export default function CheckoutDialog({ s }: { s: AppState }) {
  const [customerView, setCustomerView] = useState(false);
  useEffect(() => {
    if (!s.payOpen) setCustomerView(false);
  }, [s.payOpen]);
  return (
    <Dialog
      open={s.payOpen}
      onOpenChange={(v) => {
        if (!s.busy) s.setPayOpen(v);
      }}
    >
      <DialogContent
        className={
          customerView
            ? "payment-dialog customer-payment-dialog"
            : "payment-dialog"
        }
      >
        {customerView ? (
          <>
            <DialogHeader>
              <DialogTitle>Escanea y paga</DialogTitle>
              <DialogDescription>
                Abre la aplicación de tu banco y escanea el QR.
              </DialogDescription>
            </DialogHeader>
            <div className="customer-payment-layout">
              <div className="customer-qr">
                <img
                  src={
                    "/api/qr?v=" +
                    encodeURIComponent(s.data?.payments.qrVersion || "")
                  }
                  alt="QR bancario para pagar"
                />
              </div>
              <div className="customer-payment-details">
                <span className="eyebrow">TOTAL A PAGAR POR QR</span>
                <strong className="customer-payment-amount">
                  {money(Math.max(0, s.qrCents))}
                </strong>
                <p>{s.data?.payments.recipient}</p>
                <span>CONFIGOR CARNES</span>
                <button
                  className="secondary"
                  onClick={() => setCustomerView(false)}
                >
                  <ArrowLeft size={20} /> Volver al cobro
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Cobrar venta</DialogTitle>
              <DialogDescription>
                {s.cart.length} artículos · verifica el pago antes de confirmar.
              </DialogDescription>
            </DialogHeader>
            <div className="modal-total">{money(s.total)}</div>
            <Choice
              value={s.method}
              onChange={(v) => {
                s.setMethod(v);
                s.setConfirmed(false);
                s.setCashInput(v === "mixed" ? "" : (s.total / 100).toFixed(2));
              }}
              label="Método de pago"
              options={[
                ["cash", "Efectivo"],
                ["qr", "QR bancario"],
                ["mixed", "Efectivo + QR"],
              ]}
            />
            {s.method !== "qr" && (
              <label className="field">
                {s.method === "cash"
                  ? "Efectivo recibido (Bs)"
                  : "Parte en efectivo (Bs)"}
                <input
                  inputMode="decimal"
                  value={s.cashInput}
                  onChange={(e) => s.setCashInput(e.target.value)}
                />
              </label>
            )}
            {s.method === "cash" && (
              <div className="payment-row">
                <span>Cambio</span>
                <strong>{money(Math.max(0, s.cashCents - s.total))}</strong>
              </div>
            )}
            {s.method !== "cash" && (
              <>
                <div className="qr-payment">
                  {s.data?.payments.hasQr ? (
                    <img
                      src={
                        "/api/qr?v=" +
                        encodeURIComponent(s.data?.payments.qrVersion || "")
                      }
                      alt="QR para realizar el pago"
                    />
                  ) : (
                    <p>
                      El administrador debe subir el QR en Configuración de
                      pagos.
                    </p>
                  )}
                  <button
                    type="button"
                    className="secondary customer-view-button"
                    disabled={!s.data?.payments.hasQr}
                    onClick={() => setCustomerView(true)}
                  >
                    <Maximize2 size={20} /> Mostrar QR grande al cliente
                  </button>
                  <b>{s.data?.payments.recipient}</b>
                  <strong>Pagar por QR: {money(Math.max(0, s.qrCents))}</strong>
                </div>
                <label className="check-label">
                  <Checkbox
                    checked={s.confirmed}
                    onCheckedChange={(v) => s.setConfirmed(v === true)}
                  />{" "}
                  Verifiqué el abono en la cuenta bancaria
                </label>
              </>
            )}
            <button
              disabled={
                s.busy ||
                (s.method !== "cash" &&
                  (!s.confirmed || !s.data?.payments.hasQr))
              }
              className="primary wide"
              onClick={s.checkout}
            >
              {s.busy ? "Guardando…" : "Confirmar cobro y guardar venta"}
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
