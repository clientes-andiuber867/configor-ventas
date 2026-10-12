"use client";
import { Empty, SaleTable } from "@/components/shared/tables";
import { type AppState } from "@/features/workspace/use-workspace";
import { money } from "@/lib/domain";
import {
  ReceiptText,
  Scale,
  ScanBarcode,
  ShoppingBag,
  Wallet,
} from "lucide-react";
export function Dashboard({ s }: { s: AppState }) {
  return (
    <>
      <div className="stats">
        {[
          [
            "Ingresos por ventas",
            money(s.revenue),
            Wallet,
            "Ventas completadas del período",
          ],
          [
            "Ventas realizadas",
            String(s.completed.length),
            ReceiptText,
            s.filtered.filter((x) => x.status === "void").length + " anuladas",
          ],
          [
            "Ticket promedio",
            money(
              s.completed.length
                ? Math.round(s.revenue / s.completed.length)
                : 0,
            ),
            ShoppingBag,
            "Importe medio por venta",
          ],
          [
            "Kilos registrados",
            s.kg.toFixed(3) + " kg",
            Scale,
            s.unknownWeights
              ? s.unknownWeights + " artículos sin peso"
              : "Peso registrado en las ventas",
          ],
        ].map(([label, value, Icon, note]: any) => (
          <div className="stat" key={label}>
            <div>
              {label}
              <Icon size={19} />
            </div>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-title">
            <h2>Actividad de ventas</h2>
            <span className="badge">{s.completed.length} ventas</span>
          </div>
          {s.completed.length ? (
            <div className="sales-chart">
              {Array.from({ length: 12 }, (_, i) => {
                const val = s.completed
                  .filter(
                    (x) =>
                      Math.floor(
                        Number(
                          new Intl.DateTimeFormat("en-GB", {
                            timeZone: "America/La_Paz",
                            hour: "2-digit",
                            hour12: false,
                          }).format(new Date(x.created)),
                        ) / 2,
                      ) === i,
                  )
                  .reduce((n, x) => n + x.total, 0);
                return (
                  <div className="bar-column" key={i}>
                    <div
                      title={money(val)}
                      className="bar"
                      style={{
                        height: Math.max(3, (val / s.revenue) * 200) + "px",
                      }}
                    />
                    <small>{String(i * 2).padStart(2, "0")}h</small>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="chart-empty">
              <ReceiptText size={28} />
              <b>Tu próxima venta empieza aquí</b>
              <p>Las ventas registradas aparecerán en este resumen.</p>
              <button onClick={() => s.setPage("Punto de venta")}>
                Ir al punto de venta
              </button>
            </div>
          )}
          <div className="chart-legend">
            <span className="red-dot" /> Ingresos por hora · horario de Bolivia
          </div>
        </section>
        <section className="panel dark-panel">
          <p className="eyebrow">CONFIGOR CARNES</p>
          <h2>
            Una caja lista
            <br />
            para tu ritmo.
          </h2>
          <ScanBarcode size={58} strokeWidth={1} />
          <p>Escanea la etiqueta, revisa el importe y registra el cobro.</p>
          <button
            className="primary"
            onClick={() => s.setPage("Punto de venta")}
          >
            Abrir punto de venta
          </button>
        </section>
      </div>
      <div className="two-columns">
        <section className="panel">
          <div className="panel-title">
            <h2>Productos más vendidos</h2>
            <span className="badge">Por ingresos</span>
          </div>
          {s.ranking.length ? (
            s.ranking.slice(0, 5).map((r, i) => (
              <div className="rank" key={r.name}>
                <span className="rank-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <b>{r.name}</b>
                  <small>{r.count} paquetes vendidos</small>
                </div>
                <strong>{money(r.total)}</strong>
              </div>
            ))
          ) : (
            <Empty>El ranking aparecerá con tus primeras ventas.</Empty>
          )}
        </section>
        <section className="panel">
          <div className="panel-title">
            <h2>Distribución de cobros</h2>
            <Wallet size={19} />
          </div>
          <div className="payment-total">
            <small>Total cobrado</small>
            <strong>{money(s.revenue)}</strong>
          </div>
          <div className="payment-track">
            <span
              style={{
                width: (s.revenue ? (s.cashTotal / s.revenue) * 100 : 0) + "%",
              }}
            />
          </div>
          <div className="payment-row">
            <span>
              <i className="red-dot" />
              Efectivo
            </span>
            <b>{money(s.cashTotal)}</b>
          </div>
          <div className="payment-row">
            <span>
              <i className="black-dot" />
              QR
            </span>
            <b>{money(s.qrTotal)}</b>
          </div>
          <p className="hint">
            Los pagos mixtos se distribuyen entre efectivo y QR.
          </p>
        </section>
      </div>
      <section className="panel">
        <div className="panel-title">
          <h2>Últimas ventas</h2>
          <button onClick={() => s.setPage("Ventas")}>Ver todas</button>
        </div>
        <SaleTable sales={s.filtered.slice(0, 5)} onSelect={s.setSelected} />
      </section>
    </>
  );
}
