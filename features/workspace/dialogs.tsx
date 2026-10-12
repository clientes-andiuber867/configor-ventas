"use client";
import dynamic from "next/dynamic";
import type { AppState } from "./use-workspace";
const ManualDialog = dynamic(() => import("@/features/pos/ManualDialog"));
const CheckoutDialog = dynamic(
  () => import("@/features/payments/CheckoutDialog"),
);
const MemberDialog = dynamic(() => import("@/features/users/MemberDialog"));
const ReceiptDialog = dynamic(() => import("@/features/sales/ReceiptDialog"));
const VoidDialog = dynamic(() => import("@/features/sales/VoidDialog"));
export function Modals({ s }: { s: AppState }) {
  return (
    <>
      {s.manual && <ManualDialog s={s} />}{" "}
      {s.payOpen && <CheckoutDialog s={s} />}{" "}
      {s.member && <MemberDialog s={s} />}{" "}
      {s.selected && <ReceiptDialog s={s} />}{" "}
      {s.voidSale && <VoidDialog s={s} />}
    </>
  );
}
