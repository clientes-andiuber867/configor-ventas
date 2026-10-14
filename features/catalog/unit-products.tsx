"use client";
import { useState, type FormEvent } from "react";
import { Plus, Pencil, Package } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from "@/components/ui/table";
import { money, type Product } from "@/lib/domain";
import type { AppState } from "@/features/workspace/use-workspace";
export function UnitProducts({ s }: { s: AppState }) {
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const products = s.visibleProducts.filter((p) => p.mode === "unit");
  return (
    <section className="panel unit-products">
      <div className="panel-title">
        <div>
          <h2>
            <Package size={19} /> Productos por unidad{" "}
            <span className="badge">
              {s.data!.products.filter((p) => p.mode === "unit").length}
            </span>
          </h2>
          <p className="hint">Código de fábrica y precio fijo, sin balanza.</p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus size={17} /> Añadir producto
        </button>
      </div>
      {products.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Código de barras</TableHead>
              <TableHead>Precio / unidad</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.code}>
                <TableCell>
                  <b>{p.name}</b>
                </TableCell>
                <TableCell>
                  <code>{p.code}</code>
                </TableCell>
                <TableCell>{money(p.price)}</TableCell>
                <TableCell>
                  <button
                    className="text-button"
                    aria-label={"Editar " + p.name}
                    onClick={() => {
                      setEditing(p);
                      setOpen(true);
                    }}
                  >
                    <Pencil size={16} /> Editar
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="hint">
          {s.query
            ? "Sin coincidencias."
            : "Añade bebidas, envasados u otros productos con precio por unidad."}
        </p>
      )}
      {open && (
        <UnitDialog
          key={editing?.code || "new"}
          s={s}
          product={editing}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}
function UnitDialog({
  s,
  product,
  onClose,
}: {
  s: AppState;
  product: Product | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(product?.name || "");
  const [code, setCode] = useState(product?.code || "");
  const [price, setPrice] = useState(
    product ? (product.price / 100).toFixed(2) : "",
  );
  const [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    const normalized = price.trim().replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(normalized) || Number(normalized) <= 0) {
      setError("Introduce un precio positivo con hasta dos decimales.");
      return;
    }
    if (!product && s.data!.products.some((p) => p.code === code.trim())) {
      setError("Este código ya está registrado. Edita el producto existente.");
      return;
    }
    if (
      await s.run(
        {
          action: "unit-product",
          product: {
            code: code.trim(),
            name: name.trim(),
            price: Math.round(Number(normalized) * 100),
            mode: "unit",
            plu: "",
          },
        },
        "Producto guardado",
      )
    )
      onClose();
  }
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !s.busy) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {product ? "Editar producto" : "Producto por unidad"}
          </DialogTitle>
          <DialogDescription>
            Cada lectura añade una unidad con este precio.
          </DialogDescription>
        </DialogHeader>
        <form className="unit-product-form" onSubmit={save}>
          <label className="field">
            Nombre
            <input
              autoFocus
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={s.busy}
              placeholder="Ej. Coca-Cola 500 ml"
            />
          </label>
          <label className="field">
            Código de barras
            <input
              required
              pattern="[0-9]{4,16}"
              minLength={4}
              maxLength={16}
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={!!product || s.busy}
              placeholder="Escribe el código completo"
            />
          </label>
          <label className="field">
            Precio por unidad (Bs)
            <input
              required
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={s.busy}
              placeholder="0,00"
            />
          </label>
          {error && (
            <p role="alert" className="error-banner">
              {error}
            </p>
          )}
          <button type="submit" className="primary" disabled={s.busy}>
            {s.busy ? "Guardando…" : "Guardar producto"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
