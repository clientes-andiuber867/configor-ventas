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
import { CashRegister } from "@/features/cash-register/view";
import "./pos.css";
export function POS({ s }: { s: AppState }) {
  return (
    <div className="pos-view">
      <CashRegister
        compact={!!s.wholesaleCustomer}
        sales={s.data!.sales}
        blocked={!!s.cart.length || s.qrLocked || s.busy}
        admin={s.admin}
        onAvailability={s.setCashOpen}
      />
      <div className="pos-grid">
        <div>
          <section className="panel scan-panel">
            <div className="panel-title">
              <h2>
                <ScanBarcode size={21} /> Escanear etiqueta
              </h2>
              <span className="badge">
                {!s.cashOpen
                  ? "Caja cerrada"
                  : s.lastScan
                    ? "Lectura recibida"
                    : "Esperando lectura"}
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
                disabled={!s.cashOpen}
                aria-label="Código de barras"
                value={s.scan}
                onChange={(e) => s.changeScan(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    s.addBarcode();
                  }
                }}
                placeholder={
                  s.cashOpen
                    ? "Escanea o escribe el código de barras"
                    : "Abre tu caja para habilitar el lector"
                }
                autoComplete="off"
                inputMode="numeric"
              />
              <button className="primary" type="submit" disabled={!s.cashOpen}>
                Añadir
              </button>
            </form>
            {!s.wholesaleCustomer && (
              <p className="hint">
                {s.cashOpen
                  ? "Lee las etiquetas una tras otra. Cada producto se añade automáticamente y puedes cobrar al terminar."
                  : "Para escanear productos y realizar ventas, primero abre tu caja e indica el efectivo inicial."}
              </p>
            )}
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
                          {l.source === "manual"
                            ? "Importe manual"
                            : l.source === "unit"
                              ? "Por unidad"
                              : "Etiqueta"}
                        </small>
                      </TableCell>
                      <TableCell>
                        {l.grams === null
                          ? l.source === "unit"
                            ? "1 ud."
                            : "Sin peso"
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
                <h2>
                  {s.wholesaleCustomer
                    ? "Escanea tu primera etiqueta"
                    : "Lista para la primera etiqueta"}
                </h2>
                {!s.wholesaleCustomer && (
                  <p>Los productos que escanees se añadirán aquí.</p>
                )}
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
          {!s.wholesaleCustomer && <p className="eyebrow">RESUMEN DE VENTA</p>}
          <h2>{s.wholesaleCustomer ? "Resumen" : "Tu venta, lista."}</h2>
          <div className="payment-row">
            <span>Artículos</span>
            <b>{s.cart.length}</b>
          </div>
          <div className="payment-row">
            <span>Peso registrado</span>
            <b>
              {(s.cart.reduce((n, l) => n + (l.grams || 0), 0) / 1000).toFixed(
                3,
              )}{" "}
              kg
            </b>
          </div>
          <div className="grand-total">
            <small>Total a cobrar</small>
            <strong>{money(s.total)}</strong>
          </div>
          <button
            className="primary wide"
            disabled={!s.cart.length || !s.cashOpen}
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
          {!s.wholesaleCustomer && (
            <div className="notice">
              <ShieldCheck size={18} />
              <span>La venta se guarda al confirmar el cobro.</span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
