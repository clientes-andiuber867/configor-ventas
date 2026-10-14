"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  History,
  LoaderCircle,
  Phone,
  Plus,
  ScanBarcode,
  Search,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SaleTable } from "@/components/shared/tables";
import dynamic from "next/dynamic";
import type { AppState } from "@/features/workspace/use-workspace";
import { money, type Sale } from "@/lib/domain";
import { CUSTOMER_PAGE_SIZE, type WholesaleCustomer } from "./types";
import "./wholesale.css";
const POS = dynamic(() => import("@/features/pos/view").then((m) => m.POS));

async function request<T>(query = "", init?: RequestInit): Promise<T> {
  const response = await fetch("/api/wholesale" + query, {
    cache: "no-store",
    ...init,
  });
  const body = await response.json();
  if (!response.ok)
    throw Error(body.error || "No se pudo completar la operación.");
  return body;
}
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toLocaleUpperCase();
}
export function WholesaleView({ s }: { s: AppState }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [customers, setCustomers] = useState<WholesaleCustomer[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<"sale" | "history">("sale");
  const [historyVisited, setHistoryVisited] = useState(false);
  const directoryCache = useRef<{
    key: string;
    user: unknown;
    at: number;
  } | null>(null);
  const customer = s.wholesaleCustomer;
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (customer) return;
    const key = JSON.stringify([query, offset, retry]);
    const cached = directoryCache.current;
    if (
      cached?.key === key &&
      cached.user === s.data?.user &&
      Date.now() - cached.at < 30000
    ) {
      setLoading(false);
      setError("");
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    request<{ customers: WholesaleCustomer[]; hasMore: boolean }>(
      "?" + new URLSearchParams({ q: query, offset: String(offset) }),
      { signal: controller.signal },
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setCustomers(data.customers);
          setHasMore(data.hasMore);
          directoryCache.current = { key, user: s.data?.user, at: Date.now() };
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, offset, retry, customer?.id, s.data?.user]);
  function openProfile(next: WholesaleCustomer) {
    if (s.selectWholesaleCustomer(next)) {
      setTab("sale");
      setHistoryVisited(false);
    }
  }
  return (
    <div className="wholesale-view">
      {customer ? (
        <>
          <section className="panel wholesale-profile">
            <button
              type="button"
              className="text-button wholesale-back"
              aria-label="Volver a clientes"
              title="Volver a clientes"
              onClick={() => s.selectWholesaleCustomer(null)}
            >
              <ArrowLeft size={19} />
            </button>
            <div className="wholesale-identity">
              <span className="wholesale-avatar" aria-hidden="true">
                {initials(customer.name)}
              </span>
              <div>
                <h2>{customer.name}</h2>
                {customer.phone && (
                  <p className="muted">
                    <>
                      <Phone size={14} /> {customer.phone}
                    </>
                  </p>
                )}
              </div>
            </div>
            <div
              className="wholesale-tabs"
              role="group"
              aria-label="Vista del cliente"
            >
              <button
                type="button"
                aria-pressed={tab === "sale"}
                onClick={() => setTab("sale")}
              >
                <ScanBarcode size={17} /> Nueva venta{" "}
                {s.cart.length > 0 && (
                  <span className="badge">{s.cart.length}</span>
                )}
              </button>
              <button
                type="button"
                aria-pressed={tab === "history"}
                onClick={() => {
                  setHistoryVisited(true);
                  setTab("history");
                }}
              >
                <History size={17} /> Historial
              </button>
            </div>
          </section>
          <div hidden={tab !== "sale"}>
            <POS s={s} />
          </div>
          {historyVisited && (
            <div hidden={tab !== "history"}>
              <CustomerHistory
                key={customer.id}
                s={s}
                customer={customer}
                active={tab === "history"}
              />
            </div>
          )}
        </>
      ) : (
        <>
          <div className="wholesale-directory-bar">
            <label className="wholesale-search">
              <Search size={18} />
              <input
                aria-label="Buscar cliente mayorista"
                placeholder="Buscar por nombre…"
                maxLength={100}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            {s.admin && (
              <button className="primary" onClick={() => setCreating(true)}>
                <Plus size={18} /> Añadir cliente
              </button>
            )}
          </div>
          {error ? (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button onClick={() => setRetry((v) => v + 1)}>Reintentar</button>
            </div>
          ) : loading ? (
            <div
              className="wholesale-grid"
              aria-busy="true"
              aria-label="Cargando clientes"
            >
              {[0, 1, 2].map((i) => (
                <div key={i} className="wholesale-skeleton panel">
                  <span />
                  <div />
                  <div />
                </div>
              ))}
            </div>
          ) : customers.length ? (
            <>
              <div className="wholesale-grid">
                {customers.map((c) => (
                  <button
                    type="button"
                    className="wholesale-card"
                    key={c.id}
                    onClick={() => openProfile(c)}
                  >
                    <div className="wholesale-card-top">
                      <span className="wholesale-avatar" aria-hidden="true">
                        {initials(c.name)}
                      </span>
                      <ArrowRight size={19} />
                    </div>
                    <h3>{c.name}</h3>
                    {c.phone && <p>{c.phone}</p>}
                  </button>
                ))}
              </div>
              {(offset > 0 || hasMore) && (
                <div className="wholesale-pagination">
                  <span>Página {offset / CUSTOMER_PAGE_SIZE + 1}</span>
                  <div>
                    <button
                      className="secondary"
                      disabled={offset === 0}
                      onClick={() =>
                        setOffset((v) => Math.max(0, v - CUSTOMER_PAGE_SIZE))
                      }
                    >
                      <ChevronLeft size={16} /> Anterior
                    </button>
                    <button
                      className="secondary"
                      disabled={!hasMore}
                      onClick={() => setOffset((v) => v + CUSTOMER_PAGE_SIZE)}
                    >
                      Siguiente <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <section className="panel wholesale-empty">
              <span className="wholesale-section-icon">
                <Users size={30} />
              </span>
              <h2>
                {query
                  ? "No encontramos ese cliente"
                  : "Todavía no hay clientes"}
              </h2>
              <p className="muted">
                {query
                  ? "Prueba con otro nombre para encontrar su perfil."
                  : s.admin
                    ? "Añade un cliente para empezar."
                    : "El administrador puede añadir los clientes mayoristas para comenzar."}
              </p>
              {!query && s.admin && (
                <button className="primary" onClick={() => setCreating(true)}>
                  <Plus size={17} /> Añadir primer cliente
                </button>
              )}
            </section>
          )}
        </>
      )}
      {creating && (
        <CreateCustomer
          onClose={() => setCreating(false)}
          onCreated={(c) => {
            setCreating(false);
            setRetry((v) => v + 1);
            openProfile(c);
          }}
        />
      )}
    </div>
  );
}

type HistoryPage = {
  sales: Sale[];
  next: { created: string; id: string } | null;
};
function CustomerHistory({
  s,
  customer,
  active,
}: {
  s: AppState;
  customer: WholesaleCustomer;
  active: boolean;
}) {
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [data, setData] = useState<HistoryPage>({ sales: [], next: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const cursor = cursors.at(-1);
  const loaded = useRef<{
    cursor: string | null | undefined;
    sales: unknown;
    user: unknown;
    retry: number;
    at: number;
  } | null>(null);
  useEffect(() => {
    if (!active) return;
    const cached = loaded.current;
    if (
      cached &&
      cached.cursor === cursor &&
      cached.sales === s.data?.sales &&
      cached.user === s.data?.user &&
      cached.retry === retry &&
      Date.now() - cached.at < 30000
    ) {
      setLoading(false);
      setError("");
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ customer: customer.id });
    if (cursor) query.set("cursor", cursor);
    request<HistoryPage>("?" + query, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          loaded.current = {
            cursor,
            sales: s.data?.sales,
            user: s.data?.user,
            retry,
            at: Date.now(),
          };
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [customer.id, cursor, retry, s.data?.sales, s.data?.user, active]);
  const completed = data.sales.filter((sale) => sale.status === "completed");
  return (
    <section className="panel wholesale-history">
      <div className="panel-title">
        <div>
          <h2>{s.admin ? "Compras" : "Compras de hoy"}</h2>
        </div>
        <History size={22} />
      </div>
      {error ? (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button onClick={() => setRetry((v) => v + 1)}>Reintentar</button>
        </div>
      ) : loading ? (
        <div className="empty" role="status">
          <LoaderCircle className="animate-spin" size={22} /> Cargando compras…
        </div>
      ) : (
        <>
          {data.sales.length > 0 && (
            <div className="wholesale-history-summary">
              <span>
                {data.sales.length} ventas · página {cursors.length}
              </span>
              <span>
                Total de página{" "}
                <b>
                  {money(completed.reduce((sum, sale) => sum + sale.total, 0))}
                </b>
              </span>
            </div>
          )}
          <SaleTable sales={data.sales} onSelect={s.setSelected} />
          {(data.next || cursors.length > 1) && (
            <div className="wholesale-pagination">
              <span>Página {cursors.length}</span>
              <div>
                <button
                  className="secondary"
                  disabled={cursors.length === 1}
                  onClick={() => setCursors((v) => v.slice(0, -1))}
                >
                  <ChevronLeft size={16} /> Anterior
                </button>
                <button
                  className="secondary"
                  disabled={!data.next}
                  onClick={() =>
                    setCursors((v) => [...v, JSON.stringify(data.next)])
                  }
                >
                  Siguiente <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function CreateCustomer({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (customer: WholesaleCustomer) => void;
}) {
  const [id] = useState(() => crypto.randomUUID());
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const data = await request<{ customer: WholesaleCustomer }>("", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name, phone }),
      });
      onCreated(data.customer);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo guardar el cliente.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending.current) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir cliente mayorista</DialogTitle>
          <DialogDescription>
            Crea su perfil para reunir sus ventas y comprobantes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="wholesale-form">
          <label className="field">
            Nombre del cliente
            <input
              autoFocus
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. María Fernández"
              disabled={busy}
            />
          </label>
          <label className="field">
            Teléfono <span className="muted">(opcional)</span>
            <input
              type="tel"
              maxLength={40}
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Número de contacto"
              disabled={busy}
            />
          </label>
          {error && (
            <p role="alert" className="error-banner">
              {error}
            </p>
          )}
          <div className="wholesale-form-actions">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="primary"
              disabled={busy || name.trim().length < 2}
            >
              {busy ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : (
                <Plus size={17} />
              )}
              {busy ? "Guardando…" : "Crear cliente"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
