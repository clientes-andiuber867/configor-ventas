"use client";
import { usePaymentFlow } from "@/features/payments/use-payment-flow";

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
import { exportSalesCsv } from "@/features/sales/export";
import { toast } from "sonner";
import type { Data } from "./types";
import { api } from "./api";
import type { WholesaleCustomer } from "@/features/wholesale/types";
export function useApp() {
  const [wholesaleCustomer, setWholesaleCustomer] =
    useState<WholesaleCustomer | null>(null);
  const [cashOpen, setCashOpen] = useState(false);
  const [page, setPage] = useState("Resumen"),
    [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [from, setFrom] = useState(today()),
    [to, setTo] = useState(today()),
    [query, setQuery] = useState(""),
    [salesMethod, setSalesMethod] = useState("all"),
    [salesType, setSalesType] = useState("all");
  const [cart, setCart] = useState<Line[]>([]),
    [scan, setScan] = useState(""),
    [lastScan, setLastScan] = useState(""),
    [manual, setManual] = useState<any>(null),
    [weight, setWeight] = useState(""),
    [amount, setAmount] = useState(""),
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
  const locked = useRef(false);
  const {
    payOpen,
    setPayOpen,
    method,
    setMethod,
    cashInput,
    setCashInput,
    confirmed,
    setConfirmed,
    saleId,
    setSaleId,
    payment,
    paymentError,
    qrLocked,
    qrLoading,
    total,
    cashCents,
    qrCents,
    generatePayment,
    cancelPayment,
    changePaymentMethod,
    resetCancelledPayment,
    checkout,
  } = usePaymentFlow({
    wholesaleCustomer,
    restoreWholesaleCustomer: (customer) => {
      setWholesaleCustomer(customer);
      setPage("Ventas mayoristas");
    },
    data,
    setData,
    cart,
    setCart,
    busy,
    setBusy,
    setSelected,
    locked,
  });
  const scanRef = useRef<HTMLInputElement>(null);
  const scanBuffer = useRef("");
  const navigationRef = useRef<(next: string) => void>(() => {});
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
          if (d.user.role === "cashier")
            setPage((current) =>
              current === "Resumen" ? "Punto de venta" : current,
            );
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
    if (
      cashOpen &&
      (page === "Punto de venta" || page === "Ventas mayoristas") &&
      !manual &&
      !payOpen
    )
      scanRef.current?.focus();
  }, [page, manual, payOpen, cashOpen]);
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
            navigationRef.current("Punto de venta");
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
    if (!cashOpen) return;
    scanBuffer.current = raw;
    setScan(raw);
    if (data?.rule.enabled && raw.trim().length === data.rule.pattern.length)
      addBarcode(raw);
  }
  function addBarcode(raw = scanBuffer.current) {
    if (!cashOpen) return;
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
        if (wholesaleCustomer)
          throw Error(
            "Escanea la etiqueta completa de la balanza con su importe. Las ventas mayoristas no modifican precios.",
          );
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
    if (!cashOpen)
      return toast.error("Abre tu caja antes de añadir productos.");
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
  useEffect(() => {
    if (!data || admin) return;
    let timer: ReturnType<typeof setTimeout>;
    const rollover = () => {
      const day = today();
      if (from !== day || to !== day) {
        setSelected(null);
        setData((old) => (old ? { ...old, sales: [] } : old));
        setFrom(day);
        setTo(day);
      }
      clearTimeout(timer);
      timer = setTimeout(
        rollover,
        Math.max(
          1000,
          Date.parse(day + "T00:00:00-04:00") + 86400000 - Date.now() + 100,
        ),
      );
    };
    const onVisible = () => {
      if (!document.hidden) rollover();
    };
    rollover();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [admin, !!data, from, to]);
  const filtered = useMemo(() => {
    const currentDay = today();
    return (data?.sales || []).filter((s) => {
      const day = dayOf(s.created);
      return admin ? day >= from && day <= to : day === currentDay;
    });
  }, [data?.sales, from, to, admin]);
  const {
    completed,
    revenue,
    cashTotal,
    qrTotal,
    kg,
    unknownWeights,
    ranking,
  } = useSummary(filtered);
  const visibleProducts = useMemo(() => {
    const search = query.toLowerCase();
    return (data?.products || []).filter((p) =>
      (p.name + " " + p.code + " " + p.plu).toLowerCase().includes(search),
    );
  }, [data?.products, query]);
  const visibleSales = useMemo(
    () =>
      filtered.filter(
        (s) =>
          (salesType === "all" ||
            (salesType === "wholesale"
              ? !!s.wholesale_customer_id
              : !s.wholesale_customer_id)) &&
          (salesMethod === "all" ||
            (salesMethod === "mixed"
              ? s.cash > 0 && s.qr > 0
              : salesMethod === "qr"
                ? s.qr > 0 && s.cash === 0
                : s.cash > 0 && s.qr === 0)),
      ),
    [filtered, salesMethod, salesType],
  );
  const exportSales = () => exportSalesCsv(visibleSales);
  function selectWholesaleCustomer(customer: WholesaleCustomer | null) {
    if (
      customer?.id !== wholesaleCustomer?.id &&
      (cart.length || qrLocked || payOpen || busy || manual)
    ) {
      toast.error(
        "Finaliza la venta pendiente o vacía el carrito antes de cambiar de cliente.",
      );
      return false;
    }
    setWholesaleCustomer(customer);
    setScan("");
    scanBuffer.current = "";
    return true;
  }
  function navigate(next: string) {
    if (
      next === "Punto de venta" &&
      wholesaleCustomer &&
      !selectWholesaleCustomer(null)
    )
      return;
    setPage(next);
  }
  navigationRef.current = navigate;
  return {
    wholesaleCustomer,
    selectWholesaleCustomer,
    cashOpen,
    setCashOpen,
    page,
    setPage: navigate,
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
    checkout: () =>
      cashOpen ? checkout() : toast.error("Abre tu caja antes de vender."),
    importFile,
    payment,
    paymentError,
    qrLocked,
    qrLoading,
    generatePayment: () =>
      cashOpen
        ? generatePayment()
        : toast.error("Abre tu caja antes de cobrar."),
    resetCancelledPayment,
    cancelPayment,
    changePaymentMethod,
    saleId,
    admin,
    filtered,
    visibleSales,
    salesMethod,
    setSalesMethod,
    salesType,
    setSalesType,
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
