"use client";
import { SaleTable } from "@/components/shared/tables";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { today } from "@/lib/domain";
import {
  AlertCircle,
  ChevronRight,
  Database,
  Download,
  LayoutDashboard,
  Plus,
  QrCode,
  ReceiptText,
  RefreshCw,
  ScanBarcode,
  ShieldCheck,
  Users,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Toaster } from "sonner";
import { Modals } from "./dialogs";
import { useApp, type AppState } from "./use-workspace";
const Dashboard = dynamic(() =>
  import("@/features/dashboard/view").then((m) => m.Dashboard),
);
const POS = dynamic(() => import("@/features/pos/view").then((m) => m.POS));
const DatabaseView = dynamic(() =>
  import("@/features/catalog/view").then((m) => m.DatabaseView),
);
const UsersView = dynamic(() =>
  import("@/features/users/view").then((m) => m.UsersView),
);
const PaymentsView = dynamic(() =>
  import("@/features/payments/view").then((m) => m.PaymentsView),
);
const sections = [
  ["Resumen", LayoutDashboard],
  ["Punto de venta", ScanBarcode],
  ["Ventas", ReceiptText],
  ["Base de datos", Database],
  ["Usuarios", Users],
  ["Configuración de pagos", QrCode],
] as const;
export default function Workspace() {
  const s = useApp();
  const [period, setPeriod] = useState("today");
  return (
    <SidebarProvider>
      <Toaster richColors position="top-right" />
      <Sidebar className="brand-sidebar">
        <SidebarHeader>
          <div className="brand">
            <img src="/configor-logo.jpg" alt="CONFIGOR Carnes" />
            <span>SISTEMA DE VENTAS</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <p className="nav-caption">PRINCIPAL</p>
          <Navigation s={s} />
        </SidebarContent>
        <SidebarFooter>
          <div className="scale-note">
            <ScanBarcode size={22} />
            <div>
              Lector de códigos
              <small>
                {s.lastScan
                  ? "Lectura recibida · " + s.lastScan
                  : "Sin lectura verificada"}
              </small>
            </div>
          </div>
          <div className="profile">
            <b>{s.admin ? "AD" : "VE"}</b>
            <div>
              {s.admin ? "Administrador" : "Vendedor"}
              <small>{s.data?.user.name || "CONFIGOR Carnes"}</small>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <div className="workspace">
        <header className="topbar">
          <div>
            <SidebarTrigger />
            <span>
              CONFIGOR <i>/</i> {s.page}
            </span>
          </div>
          <div className="location">
            <ShieldCheck size={16} /> Casa central · Bolivia{" "}
            <button aria-label="Actualizar datos" onClick={() => s.load()}>
              <RefreshCw size={16} />
            </button>
          </div>
        </header>
        <main>
          <div className="heading">
            <div>
              <p className="eyebrow">
                {s.page === "Punto de venta"
                  ? "CAJA · CONFIGOR CARNES"
                  : "CONTROL DE TU NEGOCIO"}
              </p>
              <h1>
                {s.page === "Resumen" ? "Tu negocio, en un vistazo." : s.page}
              </h1>
              <p className="muted">
                {
                  (
                    {
                      Resumen: "Cada corte cuenta. Cada venta también.",
                      "Punto de venta":
                        "Escanea, revisa y cobra. Así de simple.",
                      Ventas: "Cada transacción, con todos sus detalles.",
                      "Base de datos":
                        "Los productos de tu balanza, conectados con tu caja.",
                      Usuarios: "Cada persona, con el acceso que necesita.",
                      "Configuración de pagos":
                        "Tu QR y tus datos, listos para cada cobro.",
                    } as any
                  )[s.page]
                }
              </p>
            </div>
            {s.page !== "Punto de venta" && (
              <button
                className="primary"
                onClick={() => s.setPage("Punto de venta")}
              >
                <Plus size={18} /> Nueva venta
              </button>
            )}
          </div>
          {s.error && (
            <div className="error-banner">
              <AlertCircle size={20} />
              <span>{s.error}</span>
              <button onClick={() => s.load()}>Reintentar</button>
              {s.error.includes("sesión") && (
                <button onClick={() => window.location.reload()}>
                  Iniciar sesión
                </button>
              )}
            </div>
          )}
          {!s.data && !s.error && (
            <div className="panel empty">Conectando con CONFIGOR…</div>
          )}
          {s.data && (
            <>
              {["Resumen", "Ventas"].includes(s.page) && (
                <div className="period">
                  <PeriodFilter s={s} period={period} setPeriod={setPeriod} />
                  <span>Operación en bolivianos · Bs</span>
                </div>
              )}
              {s.page === "Resumen" && s.admin && <Dashboard s={s} />}{" "}
              {s.page === "Punto de venta" && <POS s={s} />}{" "}
              {s.page === "Ventas" && (
                <section className="panel">
                  <div className="panel-title">
                    <h2>Historial · {s.filtered.length} ventas</h2>
                    <button className="secondary" onClick={s.exportSales}>
                      <Download size={16} /> Exportar CSV
                    </button>
                  </div>
                  <SaleTable sales={s.filtered} onSelect={s.setSelected} />
                </section>
              )}
              {s.page === "Base de datos" && s.admin && <DatabaseView s={s} />}{" "}
              {s.page === "Usuarios" && s.admin && <UsersView s={s} />}{" "}
              {s.page === "Configuración de pagos" && s.admin && (
                <PaymentsView s={s} />
              )}
            </>
          )}
        </main>
        <footer>
          CONFIGOR CARNES <span>Control de ventas · TM-30F</span>
        </footer>
      </div>
      <Modals s={s} />
    </SidebarProvider>
  );
}

function Navigation({ s }: { s: AppState }) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenu>
      {sections
        .filter(
          ([n]) =>
            s.admin || ["Punto de venta", "Ventas"].includes(n) || !s.data,
        )
        .map(([name, Icon]) => (
          <SidebarMenuItem key={name}>
            <SidebarMenuButton
              isActive={s.page === name}
              onClick={() => {
                s.setPage(name);
                s.setQuery("");
                setOpenMobile(false);
              }}
            >
              <Icon />
              <span>{name}</span>
              {s.page === name && <ChevronRight className="ml-auto" />}
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
    </SidebarMenu>
  );
}

function PeriodFilter({
  s,
  period,
  setPeriod,
}: {
  s: AppState;
  period: string;
  setPeriod: (value: string) => void;
}) {
  function selectPeriod(value: string) {
    setPeriod(value);
    if (value === "custom") return;
    const current = today();
    const [year, month] = current.split("-").map(Number);
    const iso = (date: Date) => date.toISOString().slice(0, 10);
    if (value === "today") {
      s.setFrom(current);
      s.setTo(current);
    } else if (value === "month") {
      s.setFrom(iso(new Date(Date.UTC(year, month - 1, 1))));
      s.setTo(iso(new Date(Date.UTC(year, month, 0))));
    } else {
      s.setFrom(iso(new Date(Date.UTC(year, month - 2, 1))));
      s.setTo(iso(new Date(Date.UTC(year, month - 1, 0))));
    }
  }
  return (
    <div className="date-controls">
      <label>
        Período
        <select value={period} onChange={(e) => selectPeriod(e.target.value)}>
          <option value="today">Hoy</option>
          <option value="month">Este mes</option>
          <option value="previous">Mes anterior</option>
          <option value="custom">Personalizado</option>
        </select>
      </label>
      {period === "custom" && (
        <>
          <label>
            Desde
            <input
              type="date"
              value={s.from}
              max={s.to}
              onChange={(e) => {
                if (e.target.value && e.target.value <= s.to)
                  s.setFrom(e.target.value);
              }}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={s.to}
              min={s.from}
              onChange={(e) => {
                if (e.target.value && e.target.value >= s.from)
                  s.setTo(e.target.value);
              }}
            />
          </label>
        </>
      )}
    </div>
  );
}
