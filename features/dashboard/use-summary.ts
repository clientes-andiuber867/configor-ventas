import type { Sale } from "@/lib/domain";
import { useMemo } from "react";
export function useSummary(filtered: Sale[]) {
  return useMemo(() => {
    const completed = filtered.filter((s) => s.status === "completed");
    let revenue = 0,
      cashTotal = 0,
      qrTotal = 0,
      grams = 0,
      unknownWeights = 0;
    const rank = new Map<
      string,
      { name: string; total: number; count: number }
    >();
    for (const sale of completed) {
      revenue += sale.total;
      cashTotal += sale.cash;
      qrTotal += sale.qr;
      for (const item of sale.items) {
        grams += item.grams || 0;
        if (item.grams === null) unknownWeights++;
        const row = rank.get(item.code) || {
          name: item.name,
          total: 0,
          count: 0,
        };
        row.total += item.amount;
        row.count++;
        rank.set(item.code, row);
      }
    }
    return {
      completed,
      revenue,
      cashTotal,
      qrTotal,
      kg: grams / 1000,
      unknownWeights,
      ranking: [...rank.values()].sort((a, b) => b.total - a.total),
    };
  }, [filtered]);
}
