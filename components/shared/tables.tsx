"use client";
import { ReceiptText } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { money, type Product, type Sale } from "@/lib/domain";
export function Choice({
  value,
  onChange,
  options,
  label,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  label: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, t]) => (
          <SelectItem key={v} value={v}>
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="empty">
      <ReceiptText size={28} />
      <p>{children}</p>
    </div>
  );
}
export function ProductTable({ products }: { products: Product[] }) {
  return products.length ? (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>PLU</TableHead>
          <TableHead>Producto</TableHead>
          <TableHead>Código</TableHead>
          <TableHead>Precio / kg</TableHead>
          <TableHead>Modo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((p) => (
          <TableRow key={p.code}>
            <TableCell>{p.plu}</TableCell>
            <TableCell>
              <b>{p.name}</b>
            </TableCell>
            <TableCell>
              <code>{p.code}</code>
            </TableCell>
            <TableCell>{money(p.price)}</TableCell>
            <TableCell>
              <span className="badge">Por peso</span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ) : (
    <Empty>Importa los productos para comenzar a reconocer etiquetas.</Empty>
  );
}
export function SaleTable({
  sales,
  onSelect,
}: {
  sales: Sale[];
  onSelect: (s: Sale) => void;
}) {
  return sales.length ? (
    <Table>
      <TableHeader>
        <TableRow>
          {["Venta / fecha", "Vendedor", "Pago", "Total", "Estado", ""].map(
            (x, i) => (
              <TableHead key={i}>{x}</TableHead>
            ),
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sales.map((s) => (
          <TableRow key={s.id}>
            <TableCell>
              <b>#{s.reference || s.id.slice(0, 8).toUpperCase()}</b>
              {s.wholesale_customer_name && (
                <small className="sub">
                  Mayorista · {s.wholesale_customer_name}
                </small>
              )}
              <small className="sub">
                {new Date(s.created).toLocaleString("es-BO", {
                  timeZone: "America/La_Paz",
                })}
              </small>
            </TableCell>
            <TableCell>{s.cashier}</TableCell>
            <TableCell>
              <span className="badge">
                {s.cash && s.qr ? "Mixto" : s.qr ? "QR" : "Efectivo"}
              </span>
            </TableCell>
            <TableCell>
              <b>{money(s.total)}</b>
            </TableCell>
            <TableCell>
              <span
                className={
                  s.status === "completed" ? "status-ok" : "status-void"
                }
              >
                {s.status === "completed" ? "Completada" : "Anulada"}
              </span>
            </TableCell>
            <TableCell>
              <button className="text-button" onClick={() => onSelect(s)}>
                Ver detalle
              </button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ) : (
    <Empty>No hay ventas en este período.</Empty>
  );
}
