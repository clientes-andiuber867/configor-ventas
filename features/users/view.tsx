"use client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type AppState } from "@/features/workspace/use-workspace";
import { Plus } from "lucide-react";
export function UsersView({ s }: { s: AppState }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Equipo de CONFIGOR</h2>
        <button
          className="primary"
          onClick={() =>
            s.setMember({ email: "", name: "", role: "cashier", active: 1 })
          }
        >
          <Plus size={17} /> Agregar usuario
        </button>
      </div>
      <p className="hint">
        Usuarios de esta instalación. Administrador: gestión completa. Vendedor:
        registrar y consultar ventas. Cada usuario entra con su usuario y
        contraseña local.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuario</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {s.data?.members.map((m) => (
            <TableRow key={m.email}>
              <TableCell>
                <b>{m.name}</b>
                <small className="sub">{m.email}</small>
              </TableCell>
              <TableCell>
                {m.role === "admin" ? "Administrador" : "Vendedor"}
              </TableCell>
              <TableCell>
                <span className={m.active ? "status-ok" : "status-void"}>
                  {m.active ? "Activo" : "Desactivado"}
                </span>
              </TableCell>
              <TableCell>
                <button
                  className="text-button"
                  onClick={() => s.setMember({ ...m })}
                >
                  Editar
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
