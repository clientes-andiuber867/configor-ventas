export type OrderCost = {
  id: string;
  name: string;
  cents: number;
  quantity: number;
};
export type CostSheet = { version: string; items: OrderCost[] };
export const emptyCostSheet: CostSheet = { version: "", items: [] };
export const orderCostTotal = (items: OrderCost[]) =>
  items.reduce((total, item) => total + item.cents * item.quantity, 0);
export function parseCost(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return cents <= 10000000 ? cents : null;
}
