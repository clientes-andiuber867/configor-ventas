export type CashSession = {
  id: string;
  cashier: string;
  opened: string;
  closed: string | null;
  opening: number;
  counted: number | null;
  expected: number | null;
  difference: number | null;
  cash_sales: number;
  qr_sales: number;
  sale_count: number;
  opening_note: string;
  closing_note: string;
};
export type CashState = {
  active: CashSession | null;
  history: CashSession[];
};
