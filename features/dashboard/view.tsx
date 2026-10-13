"use client";
import { Empty, SaleTable } from "@/components/shared/tables";
import { type AppState } from "@/features/workspace/use-workspace";
import { money } from "@/lib/domain";
import { useMemo } from "react";
import "./dashboard.css";
import {
  ReceiptText,
  Scale,
  ScanBarcode,
  ShoppingBag,
  Wallet,
  ArrowUpRight,
  ChartNoAxesCombined,
} from "lucide-react";
const boliviaHour = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/La_Paz",
  hour: "2-digit",
  hourCycle: "h23",
});
export function Dashboard({ s }: { s: AppState }) {
  const hourly = useMemo(() => {
    const totals = Array<number>(12).fill(0);
    for (const sale of s.completed) {
      const bucket = Math.floor(
        Number(boliviaHour.format(new Date(sale.created))) / 2,
      );
      totals[bucket] += sale.total;
    }
    return totals;
  }, [s.completed]);
  return (
    <div className="dashboard-view">
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
              <span className="stat-icon">
                <Icon size={19} aria-hidden="true" />
              </span>
            </div>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-title">
            <div className="dashboard-panel-heading">
              <span className="panel-symbol">
                <ChartNoAxesCombined size={19} aria-hidden="true" />
              </span>
              <div>
                <h2>Actividad de ventas</h2>
                <p>El movimiento de tu negocio</p>
              </div>
            </div>
            <span className="badge">{s.completed.length} ventas</span>
          </div>
          {s.completed.length ? (
            <div className="sales-chart">
              {hourly.map((val, i) => {
                return (
                  <div className="bar-column" key={i}>
                    <div
                      title={money(val)}
                      className="bar"
                      style={{
                        height:
                          Math.max(
                            3,
                            s.revenue > 0 ? (val / s.revenue) * 200 : 0,
                          ) + "px",
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
          <p className="eyebrow">EL SIGUIENTE PASO</p>
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
            Abrir punto de venta <ArrowUpRight size={17} aria-hidden="true" />
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
    </div>
  );
}
