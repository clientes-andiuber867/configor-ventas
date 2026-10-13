"use client";

import { useSummary } from "@/features/dashboard/use-summary";
import {
  dayOf,
  decodeBarcode,
  defaultRule,
  today,
  type BarcodeRule,
  type Line,
  type Member,
  type Product,
  type Sale,
} from "@/lib/domain";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
export type Data = {
  user: Member;
  products: Product[];
  sales: Sale[];
  members: Member[];
  payments: {
    recipient: string;
    hasQr: boolean;
    qrVersion?: string;
    gatewayReady?: boolean;
  };
  rule: BarcodeRule;
};
export async function api(body?: any, query = "") {
  const r = await fetch(
    "/api/data" + query,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {},
  );
  const d: any = await r.json();
  if (!r.ok) throw Error(d.error || "No se pudo conectar.");
  return d;
}
export function useApp() {
  const [page, setPage] = useState("Resumen"),
    [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [from, setFrom] = useState(today()),
    [to, setTo] = useState(today()),
    [query, setQuery] = useState("");
  const [cart, setCart] = useState<Line[]>([]),
    [scan, setScan] = useState(""),
    [lastScan, setLastScan] = useState(""),
    [manual, setManual] = useState<any>(null),
    [weight, setWeight] = useState(""),
    [amount, setAmount] = useState(""),
    [payOpen, setPayOpen] = useState(false),
    [method, setMethod] = useState("cash"),
    [cashInput, setCashInput] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [saleId, setSaleId] = useState(""),
    [selected, setSelected] = useState<Sale | null>(null);
  const [importRows, setImportRows] = useState<Product[]>([]),
    [importName, setImportName] = useState(""),
    [importError, setImportError] = useState(""),
    [member, setMember] = useState<Member | null>(null),
    [recipient, setRecipient] = useState(""),
    [rule, setRule] = useState<BarcodeRule>(defaultRule),
    [voidSale, setVoidSale] = useState<Sale | null>(null),
    [reason, setReason] = useState(""),
    [testCode, setTestCode] = useState(""),
    [testResult, setTestResult] = useState("");
  const [payment, setPayment] = useState<{
    reference: string;
    saleReference?: string;
    qrImage?: string;
    paid?: boolean;
    cancelled?: boolean;
    state?: string;
    dueDate?: string;
  } | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [qrLocked, setQrLocked] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const paymentRequest = useRef(false);
  const paymentEpoch = useRef(0);
  const cancelRequest = useRef(false);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("configor-pending-payment");
      if (saved) {
        const d = JSON.parse(saved);
        setCart(d.cart);
        setSaleId(d.saleId);
        setMethod(d.method);
        setCashInput(d.cashInput);
        setQrLocked(true);
        setPayOpen(true);
      }
    } catch {
      /* A malformed local draft must not prevent login. */
    }
  }, []);
  const scanRef = useRef<HTMLInputElement>(null);
  const scanBuffer = useRef("");
  const locked = useRef(false);
  const load = useCallback(async () => {
    try {
      const d = await api(undefined, "?from=" + from + "&to=" + to);
      setData(d);
      setError("");
      return d;
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }, [from, to]);
  const initialized = useRef(false);
  const requestVersion = useRef(0);
  useEffect(() => {
    const version = ++requestVersion.current;
    if (!initialized.current) {
      load().then((d) => {
        if (d && version === requestVersion.current) {
          initialized.current = true;
          setRecipient(d.payments.recipient);
          setRule(d.rule);
          if (d.user.role === "cashier") setPage("Punto de venta");
        }
      });
    } else {
      api(undefined, "?scope=sales&from=" + from + "&to=" + to)
        .then((d) => {
          if (version === requestVersion.current) {
            setData((old) => (old ? { ...old, sales: d.sales } : old));
            setError("");
          }
        })
        .catch((e) => {
          if (version === requestVersion.current) setError(e.message);
        });
    }
  }, [load, from, to]);
  useEffect(() => {
    if (page === "Punto de venta" && !manual && !payOpen)
      scanRef.current?.focus();
  }, [page, manual, payOpen]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (cart.length) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [cart.length]);
  useEffect(() => {
    const ctx = (document as any).modelContext;
    if (!ctx?.registerTool) return;
    const ctrl = new AbortController();
    Promise.resolve(
      ctx.registerTool(
        {
          name: "open_sales_workspace",
          description:
            "Open the CONFIGOR point of sale. Does not register or charge a sale.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute: (input: any) => {
            if (!input || Object.keys(input).length)
              throw Error("No parameters accepted");
            setPage("Punto de venta");
            return { view: "Punto de venta", saleRegistered: false };
          },
        },
        { signal: ctrl.signal },
      ),
    ).catch(() => {});
    return () => ctrl.abort();
  }, []);
  async function run(body: any, success: string) {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    try {
      await api(body);
      await load();
      toast.success(success);
      return true;
    } catch (e: any) {
      toast.error(e.message);
      return false;
    } finally {
      setBusy(false);
      locked.current = false;
    }
  }
  function changeScan(raw: string) {
    scanBuffer.current = raw;
    setScan(raw);
    if (data?.rule.enabled && raw.trim().length === data.rule.pattern.length)
      addBarcode(raw);
  }
  function addBarcode(raw = scanBuffer.current) {
    if (!data || !raw.trim() || manual || payOpen || selected || qrLocked)
      return;
    try {
      const d = decodeBarcode(raw, data.products, data.rule);
      setLastScan(new Date().toLocaleTimeString("es-BO"));
      scanBuffer.current = "";
      setScan("");
      if (d.amount !== null) {
        setCart((c) => [
          ...c,
          {
            id: crypto.randomUUID(),
            code: d.product.code,
            name: d.product.name,
            barcode: raw.trim(),
            grams: d.grams,
            amount: d.amount!,
            source: "label",
          },
        ]);
        toast.success(d.product.name + " añadido");
      } else {
        setManual({ ...d, barcode: raw.trim() });
        setWeight(d.grams ? String(d.grams / 1000) : "");
        setAmount("");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    scanRef.current?.focus();
  }
  function addManual() {
    const a = Math.round(Number(amount.replace(",", ".")) * 100);
    const g = weight
      ? Math.round(Number(weight.replace(",", ".")) * 1000)
      : null;
    if (
      !Number.isFinite(a) ||
      a <= 0 ||
      (g !== null && (!Number.isFinite(g) || g <= 0))
    )
      return toast.error(
        "Introduce un importe positivo y, si lo conoces, el peso.",
      );
    setCart((c) => [
      ...c,
      {
        id: crypto.randomUUID(),
        code: manual.product.code,
        name: manual.product.name,
        barcode: manual.barcode,
        grams: g,
        amount: a,
        source: "manual",
      },
    ]);
    setManual(null);
  }
  const total = cart.reduce((n, l) => n + l.amount, 0);
  const cashCents = Math.round(Number(cashInput.replace(",", ".")) * 100) || 0;
  const qrCents =
    method === "qr" ? total : method === "mixed" ? total - cashCents : 0;
  const cashApplied =
    method === "cash" ? total : method === "mixed" ? cashCents : 0;
  async function generatePayment() {
    if (
      !data?.payments.gatewayReady ||
      paymentRequest.current ||
      !saleId ||
      qrCents <= 0 ||
      method === "cash"
    )
      return;
    if (method === "mixed" && (cashCents <= 0 || cashCents >= total)) return;
    paymentRequest.current = true;
    setQrLoading(true);
    setPaymentError("");
    setQrLocked(true);
    try {
      sessionStorage.setItem(
        "configor-pending-payment",
        JSON.stringify({ cart, saleId, method, cashInput }),
      );
    } catch {
      /* Continue if browser storage is unavailable. */
    }
    try {
      const r = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: saleId,
          items: cart,
          cash: cashApplied,
          qr: qrCents,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setPayment(d);
      setConfirmed(!!d.paid);
    } catch (e: any) {
      setPaymentError(e.message);
    } finally {
      paymentRequest.current = false;
      setQrLoading(false);
    }
  }
  useEffect(() => {
    if (
      !data?.payments.gatewayReady ||
      !payOpen ||
      method !== "qr" ||
      qrLocked ||
      !saleId ||
      qrCents <= 0
    )
      return;
    const timer = setTimeout(() => {
      void generatePayment();
    }, 900);
    return () => clearTimeout(timer);
  }, [payOpen, method, cashInput, saleId, qrLocked]);
  useEffect(() => {
    if (
      busy ||
      !qrLocked ||
      !saleId ||
      !data ||
      payment?.paid ||
      payment?.cancelled
    )
      return;
    let stopped = false;
    const epoch = paymentEpoch.current;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const r = await fetch(
          "/api/payments?id=" + encodeURIComponent(saleId),
          { cache: "no-store" },
        );
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (!stopped && epoch === paymentEpoch.current) {
          setPayment(d);
          setConfirmed(!!d.paid);
          setPaymentError(
            d.state === "error"
              ? "No se recibió el QR del banco. Verifica la referencia " +
                  d.reference +
                  " antes de iniciar otro cobro."
              : "",
          );
        }
      } catch (e: any) {
        if (!stopped && epoch === paymentEpoch.current)
          setPaymentError(e.message);
      }
      if (!stopped && epoch === paymentEpoch.current)
        timer = setTimeout(poll, 3000);
    }
    timer = setTimeout(poll, 3000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [
    qrLocked,
    saleId,
    data?.user.email,
    payment?.paid,
    payment?.cancelled,
    busy,
  ]);
  async function cancelPayment(nextMethod?: string) {
    if (cancelRequest.current || busy || qrLoading || paymentRequest.current)
      return;
    cancelRequest.current = true;
    setBusy(true);
    ++paymentEpoch.current;
    try {
      const r = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", id: saleId }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (d.paid) {
        setPayment(d);
        setConfirmed(true);
        // Restore the split if an older client changed the method while QR was active.
        setMethod(d.amount === total ? "qr" : "mixed");
        setCashInput(((total - d.amount) / 100).toFixed(2));
        setPayOpen(true);
        toast.error(
          "El banco ya recibió el pago. Guarda esta venta; no se puede cancelar el cobro.",
        );
        return;
      }
      if (!d.cancelled) throw Error("El banco aún no confirmó la anulación.");
      try {
        sessionStorage.removeItem("configor-pending-payment");
      } catch {}
      setQrLocked(false);
      setPayment(null);
      setConfirmed(false);
      setPaymentError("");
      setSaleId(crypto.randomUUID());
      setMethod(nextMethod || "cash");
      setCashInput(nextMethod === "mixed" ? "" : (total / 100).toFixed(2));
      if (!nextMethod) setPayOpen(false);
      toast.success("Cobro cancelado. Puedes editar la venta.");
    } catch (e: any) {
      setPaymentError(e.message);
      toast.error(e.message);
    } finally {
      cancelRequest.current = false;
      setBusy(false);
    }
  }
  function changePaymentMethod(value: string) {
    if (busy || qrLoading || paymentRequest.current || confirmed) return;
    if (qrLocked) {
      void cancelPayment(value);
      return;
    }
    setMethod(value);
    setConfirmed(false);
    setCashInput(value === "mixed" ? "" : (total / 100).toFixed(2));
  }
  function resetCancelledPayment() {
    void cancelPayment("cash");
  }
  async function checkout() {
    if (locked.current) return;
    if (method === "cash" && cashCents < total)
      return toast.error("El efectivo recibido no cubre el total.");
    if (method === "mixed" && (cashCents <= 0 || cashCents >= total))
      return toast.error("Introduce un monto de efectivo menor al total.");
    if (qrCents > 0 && !confirmed)
      return toast.error("Confirma la recepción del pago QR.");
    locked.current = true;
    setBusy(true);
    try {
      const result = await api({
        action: "sale",
        id: saleId,
        items: cart,
        cash: cashApplied,
        qr: qrCents,
        qrConfirmed: confirmed,
      });
      setData((old) =>
        old
          ? {
              ...old,
              sales: [
                result.sale,
                ...old.sales.filter((x) => x.id !== result.sale.id),
              ],
            }
          : old,
      );
      try {
        sessionStorage.removeItem("configor-pending-payment");
      } catch {}
      setQrLocked(false);
      setPayment(null);
      setConfirmed(false);
      setPaymentError("");
      setCart([]);
      setPayOpen(false);
      setSelected(result.sale);
      toast.success("Venta registrada correctamente");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    setImportRows([]);
    setImportError("");
    setImportName(file.name);
    try {
      if (file.size > 4 * 1024 * 1024)
        throw Error("El archivo no puede superar 4 MB.");
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/catalog", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setImportRows(result.products);
    } catch (e: any) {
      setImportError(e.message);
    }
  }
  const admin = data?.user.role === "admin";
  const filtered = useMemo(
    () =>
      (data?.sales || []).filter(
        (s) => dayOf(s.created) >= from && dayOf(s.created) <= to,
      ),
    [data?.sales, from, to],
  );
  const {
    completed,
    revenue,
    cashTotal,
    qrTotal,
    kg,
    unknownWeights,
    ranking,
  } = useSummary(filtered);
  const visibleProducts = (data?.products || []).filter((p) =>
    (p.name + " " + p.code + " " + p.plu)
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  function exportSales() {
    const rows = [
      [
        "Venta",
        "Fecha",
        "Vendedor",
        "Total Bs",
        "Efectivo Bs",
        "QR Bs",
        "Estado",
      ],
      ...filtered.map((s) => [
        s.reference || s.id,
        s.created,
        s.cashier,
        (s.total / 100).toFixed(2),
        (s.cash / 100).toFixed(2),
        (s.qr / 100).toFixed(2),
        s.status,
      ]),
    ];
    download(
      "ventas-configor.csv",
      "\uFEFF" +
        rows
          .map((r) =>
            r
              .map(
                (x) =>
                  '"' +
                  String(x)
                    .replace(/^[=+@-]/, "'")
                    .replaceAll('"', '""') +
                  '"',
              )
              .join(";"),
          )
          .join("\r\n"),
      "text/csv;charset=utf-8",
    );
  }
  return {
    page,
    setPage,
    data,
    error,
    busy,
    from,
    setFrom,
    to,
    setTo,
    query,
    setQuery,
    cart,
    setCart,
    scan,
    setScan,
    lastScan,
    manual,
    setManual,
    weight,
    setWeight,
    amount,
    setAmount,
    payOpen,
    setPayOpen,
    method,
    setMethod,
    cashInput,
    setCashInput,
    confirmed,
    setConfirmed,
    setSaleId,
    selected,
    setSelected,
    importRows,
    setImportRows,
    importName,
    setImportName,
    importError,
    setImportError,
    member,
    setMember,
    recipient,
    setRecipient,
    rule,
    setRule,
    voidSale,
    setVoidSale,
    reason,
    setReason,
    testCode,
    setTestCode,
    testResult,
    setTestResult,
    scanRef,
    load,
    run,
    changeScan,
    addBarcode,
    addManual,
    total,
    cashCents,
    qrCents,
    checkout,
    importFile,
    payment,
    paymentError,
    qrLocked,
    qrLoading,
    generatePayment,
    resetCancelledPayment,
    cancelPayment,
    changePaymentMethod,
    saleId,
    admin,
    filtered,
    completed,
    revenue,
    cashTotal,
    qrTotal,
    kg,
    unknownWeights,
    ranking,
    visibleProducts,
    exportSales,
  };
}
export type AppState = ReturnType<typeof useApp>;
export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
