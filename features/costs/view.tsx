"use client";
import { useEffect, useRef, useState } from "react";
import { Calculator, Plus, Trash2, Save, RotateCcw, Undo2 } from "lucide-react";
import { money } from "@/lib/domain";
import {
  orderCostTotal,
  parseCost,
  type CostSheet,
  type OrderCost,
} from "./model";
import "./costs.css";
type Row = { id: string; name: string; cost: string; quantity: string };
const toRows = (sheet: CostSheet): Row[] =>
  sheet.items.map((i) => ({
    id: i.id,
    name: i.name,
    cost: (i.cents / 100).toFixed(2),
    quantity: String(i.quantity),
  }));
async function request(
  body?: CostSheet,
  signal?: AbortSignal,
): Promise<CostSheet> {
  const response = await fetch(
    "/api/costs",
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal,
        }
      : { cache: "no-store", signal },
  );
  const data = await response.json();
  if (!response.ok)
    throw Error(data.error || "No se pudieron guardar los costos.");
  return data;
}
export function CostsView() {
  const [sheet, setSheet] = useState<CostSheet | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [retry, setRetry] = useState(0);
  const [removed, setRemoved] = useState<{ row: Row; index: number } | null>(
    null,
  );
  const locked = useRef(false);
  const dirty =
    !!sheet && JSON.stringify(rows) !== JSON.stringify(toRows(sheet));
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    request(undefined, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setSheet(data);
          setRows(toRows(data));
          setRemoved(null);
          setSaved(false);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const items: OrderCost[] = rows.map((row) => ({
    id: row.id,
    name: row.name.trim(),
    cents: parseCost(row.cost) ?? -1,
    quantity: /^\d{1,5}$/.test(row.quantity) ? Number(row.quantity) : 0,
  }));
  const valid = items.every(
    (i) => i.name && i.cents >= 0 && i.quantity >= 1 && i.quantity <= 10000,
  );
  const total = valid ? orderCostTotal(items) : null;
  function change(id: string, field: keyof Omit<Row, "id">, value: string) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
    setSaved(false);
  }
  async function save() {
    if (!sheet || !valid || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await request({ version: sheet.version, items });
      setSheet(result);
      setRows(toRows(result));
      setRemoved(null);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  if (loading)
    return (
      <div className="panel empty" role="status">
        Cargando costos…
      </div>
    );
  if (!sheet)
    return (
      <div className="error-banner" role="alert">
        {error}
        <button onClick={() => setRetry((v) => v + 1)}>Reintentar</button>
      </div>
    );
  return (
    <div className="costs-layout">
      <section className="panel costs-editor">
        <div className="panel-title">
          <h2>Conceptos del pedido</h2>
          <span className="badge">{rows.length} / 100</span>
        </div>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        <fieldset disabled={busy} className="costs-fields">
          {rows.length ? (
            <div className="costs-rows">
              {rows.map((row, index) => {
                const item = items[index];
                return (
                  <div className="costs-row" key={row.id}>
                    <label>
                      Concepto
                      <input
                        aria-label={"Concepto " + (index + 1)}
                        maxLength={80}
                        value={row.name}
                        placeholder="Ej. Bolsa personalizada"
                        onChange={(e) => change(row.id, "name", e.target.value)}
                      />
                    </label>
                    <label>
                      Costo unitario (Bs)
                      <input
                        aria-label={"Costo unitario " + (index + 1)}
                        inputMode="decimal"
                        value={row.cost}
                        placeholder="0,20"
                        maxLength={10}
                        onChange={(e) => change(row.id, "cost", e.target.value)}
                        aria-invalid={parseCost(row.cost) === null}
                      />
                    </label>
                    <label>
                      Cantidad
                      <input
                        aria-label={"Cantidad " + (index + 1)}
                        inputMode="numeric"
                        value={row.quantity}
                        maxLength={5}
                        onChange={(e) =>
                          change(row.id, "quantity", e.target.value)
                        }
                        aria-invalid={
                          item.quantity < 1 || item.quantity > 10000
                        }
                      />
                    </label>
                    <div className="costs-subtotal">
                      <span>Subtotal</span>
                      <b>
                        {item.cents >= 0 &&
                        item.quantity >= 1 &&
                        item.quantity <= 10000
                          ? money(item.cents * item.quantity)
                          : "—"}
                      </b>
                    </div>
                    <button
                      type="button"
                      className="costs-remove"
                      aria-label={
                        "Quitar " + (row.name || "concepto " + (index + 1))
                      }
                      onClick={() => {
                        setRemoved({ row, index });
                        setRows((current) =>
                          current.filter((r) => r.id !== row.id),
                        );
                        setSaved(false);
                      }}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="costs-empty">
              <Calculator size={32} />
              <h3>¿Qué acompaña a cada pedido?</h3>
              <p>Bolsas, etiquetas, papel y otros insumos.</p>
            </div>
          )}
          <button
            className="secondary"
            disabled={rows.length >= 100}
            onClick={() => {
              setRows((current) => [
                ...current,
                { id: crypto.randomUUID(), name: "", cost: "", quantity: "1" },
              ]);
              setSaved(false);
            }}
          >
            <Plus size={17} /> Añadir concepto
          </button>
          {removed && rows.length < 100 && (
            <button
              className="text-button costs-undo"
              onClick={() => {
                setRows((current) => {
                  const next = [...current];
                  next.splice(
                    Math.min(removed.index, next.length),
                    0,
                    removed.row,
                  );
                  return next;
                });
                setRemoved(null);
              }}
            >
              <Undo2 size={15} /> Deshacer eliminación
            </button>
          )}
        </fieldset>
      </section>
      <aside className="panel costs-summary">
        <span className="costs-symbol">
          <Calculator size={23} />
        </span>
        <p className="eyebrow">COSTO POR PEDIDO</p>
        <output className="costs-total" aria-live="polite">
          {total === null ? "—" : money(total)}
        </output>
        <p className="muted">
          Referencia de los conceptos incluidos. No cambia tus precios ni tus
          ventas.
        </p>
        {!valid && (
          <p className="costs-validation">
            Completa cada concepto con un costo válido y una cantidad entera.
          </p>
        )}
        <button
          className="primary wide"
          disabled={busy || !dirty || !valid}
          onClick={save}
        >
          <Save size={17} /> {busy ? "Guardando…" : "Guardar costos"}
        </button>
        <p className="costs-save-status" role="status">
          {dirty
            ? "Cambios sin guardar"
            : saved
              ? "Costos guardados"
              : "Referencia guardada"}
        </p>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => {
            if (
              !dirty ||
              window.confirm(
                "Se descartarán los cambios sin guardar. ¿Recargar los costos guardados?",
              )
            )
              setRetry((v) => v + 1);
          }}
        >
          <RotateCcw size={14} /> Recargar guardados
        </button>
      </aside>
    </div>
  );
}
