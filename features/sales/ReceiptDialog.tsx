"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Printer } from "lucide-react";
import { money, type Sale } from "@/lib/domain";
import type { AppState } from "@/features/workspace/use-workspace";

function Ticket({ sale }: { sale: Sale }) {
  return (
    <article className="thermal-ticket">
      <header className="ticket-brand">
        <h2>CONFIGOR</h2>
        <span>CARNES</span>
      </header>
      <div className="ticket-heading">
        <b>COMPROBANTE DE VENTA</b>
        <strong>{sale.reference || sale.id.slice(0, 8).toUpperCase()}</strong>
      </div>
      <div className="ticket-meta">
        <p>
          {new Date(sale.created).toLocaleString("es-BO", {
            timeZone: "America/La_Paz",
            hour12: false,
          })}
        </p>
        <p>Caja: {sale.cashier}</p>
        {sale.wholesale_customer_name && (
          <p>Cliente mayorista: {sale.wholesale_customer_name}</p>
        )}
      </div>
      <div className="ticket-columns">
        <span>DETALLE</span>
        <span>IMPORTE</span>
      </div>
      <div>
        {sale.items.map((l, i) => (
          <div className="ticket-item" key={i}>
            <div>
              <b>{l.name}</b>
              <small>
                {l.grams === null
                  ? "1 unidad · peso no registrado"
                  : (l.grams / 1000).toFixed(3) + " kg"}
              </small>
            </div>
            <span>{money(l.amount)}</span>
          </div>
        ))}
      </div>
      <div className="ticket-total">
        <b>TOTAL</b>
        <strong>{money(sale.total)}</strong>
      </div>
      <div className="ticket-payments">
        {sale.cash > 0 && (
          <p>
            <span>Efectivo</span>
            <span>{money(sale.cash)}</span>
          </p>
        )}
        {sale.qr > 0 && (
          <p>
            <span>Pago QR</span>
            <span>{money(sale.qr)}</span>
          </p>
        )}
      </div>
      {sale.status === "void" && (
        <p className="ticket-void">ANULADA: {sale.void_reason}</p>
      )}
      <footer className="ticket-footer">
        <b>Gracias por tu compra</b>
        <span>Conserva tu comprobante</span>
        <small>Documento interno · no es factura fiscal</small>
      </footer>
    </article>
  );
}
export default function ReceiptDialog({ s }: { s: AppState }) {
  const [paper, setPaper] = useState("80");
  const [mounted, setMounted] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setMounted(true);
    try {
      setPaper(
        localStorage.getItem("configor-receipt-paper") === "58" ? "58" : "80",
      );
    } catch {}
  }, []);
  useEffect(() => {
    if (!s.selected) return;
    const style = document.createElement("style");
    style.media = "print";
    document.head.append(style);
    const prepare = () => {
      const height =
        Math.ceil(((printRef.current?.scrollHeight || 400) * 25.4) / 96) + 3;
      style.textContent = `@page { size: ${paper}mm ${height}mm; margin: 0; }`;
    };
    window.addEventListener("beforeprint", prepare);
    return () => {
      window.removeEventListener("beforeprint", prepare);
      style.remove();
    };
  }, [paper, s.selected]);
  return (
    <>
      {mounted &&
        s.selected &&
        createPortal(
          <div
            id="receipt-print-root"
            ref={printRef}
            aria-hidden="true"
            style={{ width: `${paper}mm` }}
          >
            <Ticket sale={s.selected} />
          </div>,
          document.body,
        )}
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
              Listo para tu impresora térmica.
            </DialogDescription>
          </DialogHeader>
          {s.selected && (
            <>
              <label className="ticket-paper-control">
                Ancho del papel
                <select
                  value={paper}
                  onChange={(e) => {
                    setPaper(e.target.value);
                    try {
                      localStorage.setItem(
                        "configor-receipt-paper",
                        e.target.value,
                      );
                    } catch {}
                  }}
                >
                  <option value="80">80 mm · estándar</option>
                  <option value="58">58 mm · compacto</option>
                </select>
              </label>
              <div className="ticket-preview">
                <div style={{ width: `${paper}mm` }}>
                  <Ticket sale={s.selected} />
                </div>
              </div>
              <p className="hint">
                Selecciona el mismo papel en la impresora, escala 100 % y sin
                encabezados ni pies de página.
              </p>
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
    </>
  );
}
