"use client";
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type RefObject,
} from "react";
import { toast } from "sonner";
import type { Line, Sale } from "@/lib/domain";
import type { Data } from "@/features/workspace/types";
import { api } from "@/features/workspace/api";
type Context = {
  locked: RefObject<boolean>;
  data: Data | null;
  setData: Dispatch<SetStateAction<Data | null>>;
  cart: Line[];
  setCart: Dispatch<SetStateAction<Line[]>>;
  busy: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setSelected: Dispatch<SetStateAction<Sale | null>>;
};
export function usePaymentFlow({
  data,
  setData,
  cart,
  setCart,
  busy,
  setBusy,
  setSelected,
  locked,
}: Context) {
  const [payOpen, setPayOpen] = useState(false),
    [method, setMethod] = useState("cash"),
    [cashInput, setCashInput] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [saleId, setSaleId] = useState("");
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

  return {
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
  };
}
