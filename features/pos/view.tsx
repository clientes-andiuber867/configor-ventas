"use client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type AppState } from "@/features/workspace/use-workspace";
import { money } from "@/lib/domain";
import { ScanBarcode, ShieldCheck, Trash2, Wallet } from "lucide-react";
export function POS({ s }: { s: AppState }) {
  return (
    <div className="pos-grid">
      <div>
        <section className="panel scan-panel">
          <div className="panel-title">
            <h2>
              <ScanBarcode size={21} /> Escanear etiqueta
            </h2>
            <span className="badge">
              {s.lastScan ? "Lectura recibida" : "Esperando lectura"}
            </span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              s.addBarcode();
            }}
            className="scan-input"
          >
            <ScanBarcode size={25} />
            <input
              ref={s.scanRef}
              aria-label="Código de barras"
              value={s.scan}
              onChange={(e) => s.changeScan(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  s.addBarcode();
                }
              }}
              placeholder="Escanea o escribe el código de barras"
              autoComplete="off"
              inputMode="numeric"
            />
            <button className="primary" type="submit">
              Añadir
            </button>
          </form>
          <p className="hint">
            Escanea y el producto se añade automáticamente al completar el
            código de la balanza. Puedes leer varias etiquetas seguidas y cobrar
            al terminar.
          </p>
        </section>
        <section className="panel cart-panel">
          <div className="panel-title">
            <h2>Detalle de la venta</h2>
            <span className="badge">{s.cart.length} artículos</span>
          </div>
          {s.cart.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Peso</TableHead>
                  <TableHead>Importe</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.cart.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <b>{l.name}</b>
                      <small className="sub">
                        {l.code} ·{" "}
                        {l.source === "manual" ? "Importe manual" : "Etiqueta"}
                      </small>
                    </TableCell>
                    <TableCell>
                      {l.grams === null
                        ? "Sin peso"
                        : (l.grams / 1000).toFixed(3) + " kg"}
                    </TableCell>
                    <TableCell>
                      <b>{money(l.amount)}</b>
                    </TableCell>
                    <TableCell>
                      <button
                        disabled={s.qrLocked}
                        aria-label={"Quitar " + l.name}
                        onClick={() =>
                          s.setCart((c) => c.filter((x) => x.id !== l.id))
                        }
                      >
                        <Trash2 size={17} />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="cart-empty">
              <div>
                <ScanBarcode size={48} strokeWidth={1} />
              </div>
              <h2>Lista para la primera etiqueta</h2>
              <p>Los productos que escanees se añadirán aquí.</p>
              {!s.data?.products.length && s.admin && (
                <button
                  className="text-button"
                  onClick={() => s.setPage("Base de datos")}
                >
                  Importar productos de la balanza
                </button>
              )}
            </div>
          )}
        </section>
      </div>
      <aside className="panel checkout-summary">
        <p className="eyebrow">RESUMEN DE VENTA</p>
        <h2>Orden actual</h2>
        <div className="payment-row">
          <span>Artículos</span>
          <b>{s.cart.length}</b>
        </div>
        <div className="payment-row">
          <span>Peso registrado</span>
          <b>
            {(s.cart.reduce((n, l) => n + (l.grams || 0), 0) / 1000).toFixed(3)}{" "}
            kg
          </b>
        </div>
        <div className="grand-total">
          <small>Total a cobrar</small>
          <strong>{money(s.total)}</strong>
        </div>
        <button
          className="primary wide"
          disabled={!s.cart.length}
          onClick={() => {
            if (!s.qrLocked) {
              s.setMethod("cash");
              s.setCashInput((s.total / 100).toFixed(2));
              s.setConfirmed(false);
              s.setSaleId(crypto.randomUUID());
            }
            s.setPayOpen(true);
          }}
        >
          <Wallet size={18} />{" "}
          {s.qrLocked ? "Retomar cobro QR" : "Cobrar venta"}
        </button>
        {s.qrLocked && !s.confirmed && (
          <button
            className="secondary wide"
            disabled={s.busy || s.qrLoading}
            onClick={() => s.cancelPayment()}
          >
            {s.busy ? "Cancelando cobro…" : "Cancelar cobro y editar"}
          </button>
        )}
        <p className="hint">
          {s.qrLocked
            ? "Cancela el cobro pendiente para añadir o quitar productos."
            : "Efectivo, QR o pago mixto."}
        </p>
        <div className="notice">
          <ShieldCheck size={18} />
          <span>La venta se guarda al confirmar el cobro.</span>
        </div>
      </aside>
    </div>
  );
}
