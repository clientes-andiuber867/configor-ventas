import type { Member, Product, Sale, BarcodeRule } from "@/lib/domain";
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
