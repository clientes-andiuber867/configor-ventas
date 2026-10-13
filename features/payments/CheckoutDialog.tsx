"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Maximize2,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  CircleAlert,
} from "lucide-react";
import { Choice } from "@/components/shared/tables";
import { money } from "@/lib/domain";
import type { AppState } from "@/features/workspace/use-workspace";

function PaymentStatus({ s }: { s: AppState }) {
  const state = s.confirmed
    ? "paid"
    : s.payment?.cancelled
      ? "cancelled"
      : s.paymentError
        ? "error"
        : s.qrLoading
          ? "loading"
          : s.payment?.qrImage
            ? "waiting"
            : "loading";
  const Icon =
    state === "paid"
      ? CheckCircle2
      : state === "cancelled" || state === "error"
        ? CircleAlert
        : state === "waiting"
          ? Clock3
          : LoaderCircle;
  const title =
    state === "paid"
      ? "Pago verificado"
      : state === "cancelled"
        ? "QR anulado"
        : state === "error"
          ? "Verificando conexión"
          : state === "waiting"
            ? "Esperando el pago"
            : s.method === "mixed" && !s.qrLocked
              ? "Prepara el pago mixto"
              : "Preparando tu QR";
  const detail =
    state === "paid"
      ? "El banco confirmó el abono. Ya puedes guardar la venta."
      : state === "waiting"
        ? "Escanea el QR. Te avisaremos aquí cuando llegue el abono."
        : state === "error"
          ? "Todavía no podemos confirmar el pago. Revisa el aviso de abajo."
          : state === "cancelled"
            ? "Elige otro método para continuar."
            : s.method === "mixed" && !s.qrLocked
              ? "Indica el efectivo y genera el QR del saldo."
              : "Un momento, estamos conectando con el banco.";
  return (
    <div
      className={`payment-status payment-status--${state}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="payment-status-icon">
        <Icon size={28} />
      </span>
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
        {state === "waiting" && (
          <small>
            <i /> Verificación automática activa
          </small>
        )}
      </div>
    </div>
  );
}

export default function CheckoutDialog({ s }: { s: AppState }) {
  const [customerView, setCustomerView] = useState(false);
  useEffect(() => {
    if (!s.payOpen) setCustomerView(false);
  }, [s.payOpen]);
  const qr = s.payment?.qrImage;
  const qrSrc = qr
    ? qr.startsWith("data:image/png;base64,")
      ? qr
      : "data:image/png;base64," + qr
    : "";
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
        <DialogHeader>
          <DialogTitle>
            {s.confirmed
              ? "Pago recibido"
              : customerView
                ? "Escanea y paga"
                : "Cobrar venta"}
          </DialogTitle>
          <DialogDescription>
            {s.payment?.reference
              ? "Venta prevista: " +
                (s.payment.saleReference || s.payment.reference)
              : "El QR se genera con el importe exacto de esta venta."}
          </DialogDescription>
        </DialogHeader>
        {customerView ? (
          <div className="customer-payment-layout">
            <div className="customer-qr">
              {s.confirmed ? (
                <div className="payment-success-seal">
                  <CheckCircle2 size={100} strokeWidth={1.5} />
                  <strong>¡Pago recibido!</strong>
                  <span>
                    {s.payment?.saleReference || s.payment?.reference}
                  </span>
                </div>
              ) : s.payment?.cancelled ? (
                <CircleAlert size={80} />
              ) : (
                <img src={qrSrc} alt="QR bancario de esta compra" />
              )}
            </div>
            <div className="customer-payment-details">
              <span className="eyebrow">TOTAL A PAGAR POR QR</span>
              <strong className="customer-payment-amount">
                {money(s.qrCents)}
              </strong>
              <p>{s.data?.payments.recipient}</p>
              <b>{s.payment?.saleReference || s.payment?.reference}</b>
              <PaymentStatus s={s} />
              {s.paymentError && <p role="alert">{s.paymentError}</p>}
              <button
                className="secondary"
                onClick={() => setCustomerView(false)}
              >
                <ArrowLeft size={20} /> Volver al cobro
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="modal-total">{money(s.total)}</div>
            <fieldset
              disabled={s.busy || s.qrLoading || s.confirmed}
              style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
            >
              <Choice
                value={s.method}
                disabled={s.busy || s.qrLoading || s.confirmed}
                onChange={s.changePaymentMethod}
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
                    disabled={s.qrLocked}
                    inputMode="decimal"
                    value={s.cashInput}
                    onChange={(e) => s.setCashInput(e.target.value)}
                  />
                </label>
              )}
            </fieldset>
            {s.method === "cash" && (
              <div className="payment-row">
                <span>Cambio</span>
                <strong>{money(Math.max(0, s.cashCents - s.total))}</strong>
              </div>
            )}
            {s.method !== "cash" && (
              <div className="qr-payment">
                <PaymentStatus s={s} />
                {!s.data?.payments.gatewayReady && (
                  <p>
                    Falta configurar la conexión con Banco Económico en el
                    servidor.
                  </p>
                )}
                {qrSrc && !s.payment?.cancelled && !s.confirmed && (
                  <img
                    src={qrSrc}
                    alt={
                      "QR de pago " +
                      (s.payment?.saleReference || s.payment?.reference)
                    }
                  />
                )}
                <strong>Pagar por QR: {money(Math.max(0, s.qrCents))}</strong>
                {s.payment?.reference && (
                  <b>
                    Venta prevista:{" "}
                    {s.payment.saleReference || s.payment.reference}
                  </b>
                )}
                <p>{s.data?.payments.recipient}</p>
                {s.payment?.dueDate && (
                  <small>Vencimiento: {s.payment.dueDate}</small>
                )}
                {s.payment?.cancelled && (
                  <button
                    className="secondary"
                    onClick={s.resetCancelledPayment}
                  >
                    Elegir otro método de pago
                  </button>
                )}
                {s.paymentError && !qrSrc && (
                  <button
                    className="secondary"
                    disabled={s.qrLoading}
                    onClick={s.generatePayment}
                  >
                    Reintentar con la misma referencia
                  </button>
                )}
                {s.paymentError && (
                  <p className="error-banner" role="alert">
                    {s.paymentError}
                  </p>
                )}
                {!s.qrLocked && s.method === "mixed" && (
                  <button
                    className="secondary"
                    disabled={
                      !s.data?.payments.gatewayReady ||
                      s.cashCents <= 0 ||
                      s.cashCents >= s.total
                    }
                    onClick={s.generatePayment}
                  >
                    Generar QR del saldo
                  </button>
                )}
                <button
                  className="secondary customer-view-button"
                  disabled={!qrSrc || !!s.payment?.cancelled}
                  onClick={() => setCustomerView(true)}
                >
                  <Maximize2 size={20} /> Mostrar QR grande al cliente
                </button>
                {s.qrLocked && (
                  <small>
                    El importe queda reservado. Puedes cerrar esta ventana y
                    retomar el mismo cobro.
                  </small>
                )}
              </div>
            )}
            {s.qrLocked && !s.confirmed && (
              <button
                className="secondary wide"
                disabled={s.busy || s.qrLoading}
                onClick={() => s.cancelPayment()}
              >
                {s.busy
                  ? "Verificando y cancelando…"
                  : "Cancelar cobro y editar venta"}
              </button>
            )}
            <button
              disabled={s.busy || (s.method !== "cash" && !s.confirmed)}
              className={
                s.confirmed
                  ? "primary wide payment-save-confirmed"
                  : "primary wide"
              }
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
