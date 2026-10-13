"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Banknote,
  CircleCheck,
  DoorOpen,
  History,
  LockKeyhole,
  RefreshCw,
  X,
} from "lucide-react";
import { money, type Sale } from "@/lib/domain";
import type { CashState } from "./types";
import "./cash-register.css";

const date = (value: string) =>
  new Date(value).toLocaleString("es-BO", {
    timeZone: "America/La_Paz",
    dateStyle: "short",
    timeStyle: "short",
  });
async function request(body?: unknown, history = false): Promise<CashState> {
  const response = await fetch(
    "/api/cash-register" + (history ? "?history=1" : ""),
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {},
  );
  const result = await response.json();
  if (!response.ok)
    throw Error(result.error || "No se pudo consultar la caja.");
  return result;
}
export function CashRegister({
  sales,
  blocked,
  admin,
  onAvailability,
}: {
  sales: Sale[];
  blocked: boolean;
  admin: boolean;
  onAvailability: (open: boolean) => void;
}) {
  const [state, setState] = useState<CashState | null>(null);
  const [mode, setMode] = useState<"open" | "close" | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(false);
  const requestVersion = useRef(0);
  const operationId = useRef("");
  const locked = useRef(false);
  const load = useCallback(async (includeHistory = false) => {
    const version = ++requestVersion.current;
    try {
      const result = await request(undefined, includeHistory);
      if (version === requestVersion.current) {
        setState((previous) => ({
          ...result,
          history: includeHistory ? result.history : previous?.history || [],
        }));
        setError("");
      }
      return result;
    } catch (e) {
      if (version === requestVersion.current) setError((e as Error).message);
      return null;
    }
  }, []);
  useEffect(() => {
    void load();
    return () => {
      requestVersion.current++;
    };
  }, [sales, load]);
  const active = state?.active;
  useEffect(() => {
    onAvailability(!!active && !error && !busy && !mode);
    return () => onAvailability(false);
  }, [active, error, busy, mode, onAvailability]);
  useEffect(() => {
    const channel = new BroadcastChannel("configor-cash-register");
    channel.onmessage = () => {
      void load();
    };
    const refresh = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      channel.close();
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  const normalized = amount.trim().replace(",", ".");
  const cents = /^\d{1,7}(\.\d{1,2})?$/.test(normalized)
    ? Math.round(Number(normalized) * 100)
    : null;
  const difference =
    mode === "close" && cents !== null && active ? cents - active.expected! : 0;
  async function edit(next: "open" | "close") {
    if (busy) return;
    setBusy(true);
    // Opening does not need a preview query: POST validates the latest state
    // atomically. Closing still refreshes the displayed reconciliation.
    const result = next === "open" ? state : await load();
    setBusy(false);
    if (!result) return;
    if ((next === "close") !== !!result.active) return;
    operationId.current = result.active?.id || crypto.randomUUID();
    setAmount("");
    setNote("");
    setNotice("");
    setMode(next);
    setHistory(false);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (
      locked.current ||
      blocked ||
      cents === null ||
      cents > 100000000 ||
      !mode
    )
      return;
    locked.current = true;
    setBusy(true);
    setError("");
    ++requestVersion.current;
    try {
      const result = await request({
        action: mode,
        id: operationId.current,
        amount: cents,
        note,
      });
      setState(result);
      const channel = new BroadcastChannel("configor-cash-register");
      channel.postMessage("changed");
      channel.close();
      setNotice(
        mode === "open"
          ? "Caja abierta. Las nuevas ventas se registran en este turno."
          : "Caja cerrada. El arqueo quedó guardado.",
      );
      setHistory(mode === "close");
      setMode(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="cash-register"
      aria-label="Control de caja"
      aria-busy={busy}
    >
      <div className="cash-register-bar">
        <span className={active ? "cash-symbol is-open" : "cash-symbol"}>
          <Banknote size={22} aria-hidden="true" />
        </span>
        <div className="cash-status">
          <strong>
            {!state
              ? "Control de caja"
              : active
                ? "Tu caja está abierta"
                : "Abre tu caja"}
          </strong>
          <small>
            {active
              ? "Desde " + date(active.opened)
              : "Registra tu fondo inicial para controlar el efectivo del turno."}
          </small>
        </div>
        {active && (
          <div className="cash-balance">
            <small>Efectivo esperado</small>
            <strong>{money(active.expected!)}</strong>
          </div>
        )}
        <div className="cash-actions">
          <button
            type="button"
            className="cash-history"
            title="Ver cierres de caja"
            aria-label="Ver cierres de caja"
            disabled={busy || !!mode}
            onClick={async () => {
              if (!history) await load(true);
              setHistory(!history);
            }}
          >
            <History size={18} />
          </button>
          <button
            type="button"
            className={active ? "secondary" : "primary"}
            disabled={!state || busy || blocked || !!mode}
            onClick={() => edit(active ? "close" : "open")}
          >
            {active ? <LockKeyhole size={16} /> : <DoorOpen size={17} />}
            {active ? "Cerrar caja" : "Abrir caja"}
          </button>
        </div>
      </div>
      {blocked && (
        <p className="cash-hint">
          Termina o cancela la venta actual antes de abrir o cerrar caja.
        </p>
      )}
      {error && (
        <p className="cash-error" role="alert">
          {error}{" "}
          <button type="button" disabled={busy} onClick={() => load(history)}>
            <RefreshCw size={14} /> Reintentar
          </button>
        </p>
      )}
      {notice && (
        <p className="cash-success" role="status">
          <CircleCheck size={16} />
          {notice}
        </p>
      )}
      {mode && (
        <form className="cash-form" onSubmit={submit}>
          <div className="cash-form-title">
            <h2>{mode === "open" ? "Comenzar turno" : "Arqueo y cierre"}</h2>
            <button
              type="button"
              aria-label="Cancelar arqueo"
              disabled={busy}
              onClick={() => setMode(null)}
            >
              <X size={18} />
            </button>
          </div>
          {mode === "close" && active && (
            <>
              <div className="cash-metrics">
                <span>
                  Fondo inicial<b>{money(active.opening)}</b>
                </span>
                <span>
                  Ventas en efectivo<b>{money(active.cash_sales)}</b>
                </span>
                <span>
                  Ventas QR<b>{money(active.qr_sales)}</b>
                </span>
                <span>
                  Efectivo esperado<b>{money(active.expected!)}</b>
                </span>
              </div>
              <p className="cash-hint">
                Cuenta solo billetes y monedas. El QR no forma parte del
                efectivo. {active.sale_count} ventas completadas en este turno.
              </p>
            </>
          )}
          <div className="cash-fields">
            <label className="field">
              {mode === "open"
                ? "Efectivo inicial (Bs)"
                : "Efectivo total contado (Bs)"}
              <input
                autoFocus
                required
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="field">
              Observaciones{" "}
              {difference ? "(obligatorio por diferencia)" : "(opcional)"}
              <textarea
                maxLength={1000}
                rows={2}
                required={difference !== 0}
                placeholder={
                  mode === "open"
                    ? "Por ejemplo: fondo para cambio"
                    : "Por ejemplo: motivo del faltante o sobrante"
                }
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={busy}
              />
            </label>
          </div>
          {mode === "close" && cents !== null && (
            <p
              className={difference ? "cash-difference" : "cash-success"}
              role="status"
            >
              {difference === 0
                ? "La caja cuadra."
                : difference < 0
                  ? "Faltante: " + money(-difference)
                  : "Sobrante: " + money(difference)}
            </p>
          )}
          <button
            className="primary"
            disabled={
              busy ||
              blocked ||
              cents === null ||
              cents > 100000000 ||
              (!!difference && !note.trim())
            }
          >
            {busy
              ? "Guardando…"
              : mode === "open"
                ? "Confirmar apertura"
                : "Confirmar cierre"}
          </button>
        </form>
      )}
      {history && (
        <div className="cash-history-list">
          <h2>
            {admin
              ? "Últimos 50 cierres · todos los usuarios"
              : "Tus cierres de hoy"}
          </h2>
          {!state?.history.length && (
            <p className="cash-hint">Aún no hay cierres registrados.</p>
          )}
          {state?.history.map((session) => (
            <details key={session.id}>
              <summary>
                <span>
                  {date(session.closed!)}
                  <small>{session.cashier}</small>
                </span>
                <strong>
                  {money(session.counted!)}
                  <small className={session.difference ? "cash-warning" : ""}>
                    {session.difference === 0
                      ? "Caja cuadrada"
                      : session.difference! < 0
                        ? "Faltante " + money(-session.difference!)
                        : "Sobrante " + money(session.difference!)}
                  </small>
                </strong>
              </summary>
              <div className="cash-metrics">
                <span>
                  Fondo inicial<b>{money(session.opening)}</b>
                </span>
                <span>
                  Efectivo ventas<b>{money(session.cash_sales)}</b>
                </span>
                <span>
                  QR<b>{money(session.qr_sales)}</b>
                </span>
                <span>
                  Esperado<b>{money(session.expected!)}</b>
                </span>
              </div>
              <p className="cash-hint">
                Apertura: {date(session.opened)} · {session.sale_count} ventas
              </p>
              {session.opening_note && <p>Apertura: {session.opening_note}</p>}
              <p>Cierre: {session.closing_note || "Sin observaciones."}</p>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
