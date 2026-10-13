"use client";
import { type AppState } from "@/features/workspace/use-workspace";
import {
  AlertCircle,
  CheckCircle2,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  Wallet,
} from "lucide-react";
export function PaymentsView({ s }: { s: AppState }) {
  return (
    <div className="two-columns">
      <section className="panel">
        <div className="panel-title">
          <h2>QR de cobro</h2>
          <QrCode size={21} />
        </div>
        <div className="qr-preview">
          <QrCode size={80} strokeWidth={1} />
          <p>QR dinámico · Banco Económico</p>
        </div>
        <p>
          {s.data?.payments.gatewayReady
            ? "Credenciales configuradas en el servidor."
            : "Falta configurar las credenciales bancarias en el servidor."}
        </p>
        <p className="hint">
          Cada compra genera un QR de un solo uso, con importe fijo y una
          referencia como C000001. En pagos mixtos se cobra únicamente el saldo.
        </p>
      </section>
      <section className="panel">
        <div className="panel-title">
          <h2>Datos del beneficiario</h2>
          <ShieldCheck size={20} />
        </div>
        <label className="field">
          Nombre del titular
          <input
            value={s.recipient}
            onChange={(e) => s.setRecipient(e.target.value)}
            placeholder="Nombre de la cuenta receptora"
          />
        </label>
        <button
          className="primary"
          disabled={s.busy || !s.recipient.trim()}
          onClick={() =>
            s.run(
              { action: "payments", recipient: s.recipient },
              "Datos de cobro guardados",
            )
          }
        >
          Guardar datos
        </button>
        <div className="notice">
          <AlertCircle size={20} />
          <span>
            Configor consulta al banco automáticamente y habilita el registro de
            la venta cuando el pago está confirmado. El nombre del titular es
            informativo; la cuenta receptora se configura en el servidor.
          </span>
        </div>
        <h2 className="spaced">Métodos disponibles</h2>
        {[
          [Wallet, "Efectivo"],
          [QrCode, "QR bancario"],
          [ShoppingBag, "Pago mixto"],
        ].map(([Icon, name]: any) => (
          <div className="method-item" key={name}>
            <Icon size={19} />
            <span>{name}</span>
            <CheckCircle2 size={17} />
          </div>
        ))}
      </section>
    </div>
  );
}
