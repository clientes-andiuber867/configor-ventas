"use client";
import { type AppState } from "@/features/workspace/use-workspace";
import {
  AlertCircle,
  CheckCircle2,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  Upload,
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
          {s.data?.payments.hasQr ? (
            <img
              src={
                "/api/qr?v=" +
                encodeURIComponent(s.data?.payments.qrVersion || "")
              }
              alt="QR bancario de CONFIGOR"
            />
          ) : (
            <>
              <QrCode size={80} strokeWidth={1} />
              <p>Agrega el QR de tu cuenta bancaria</p>
            </>
          )}
        </div>
        <label className="secondary file-button">
          <Upload size={17} />{" "}
          {s.data?.payments.hasQr ? "Cambiar QR" : "Subir QR bancario"}
          <input
            disabled={s.busy}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              s.uploadQR(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <p className="hint">
          PNG, JPG o WebP · máximo 2 MB. Usa un QR reutilizable de tu banco, sin
          monto fijo.
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
            Este QR se muestra en cada cobro. El cajero debe verificar el abono
            en la cuenta; el sistema no consulta al banco.
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
