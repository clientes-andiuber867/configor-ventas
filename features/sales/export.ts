"use client";
import type { Sale } from "@/lib/domain";
import { download } from "@/lib/download";
export function exportSalesCsv(filtered: Sale[]) {
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
