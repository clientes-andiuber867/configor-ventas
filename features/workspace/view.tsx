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
  LogOut,
  LoaderCircle,
  Plus,
  QrCode,
  ReceiptText,
  RefreshCw,
  ScanBarcode,
  Users,
  Store,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Toaster } from "sonner";
import { Modals } from "./dialogs";
import { useApp, type AppState } from "./use-workspace";
import "./workspace-chrome.css";
const Dashboard = dynamic(() =>
  import("@/features/dashboard/view").then((m) => m.Dashboard),
);
const POS = dynamic(() => import("@/features/pos/view").then((m) => m.POS));
const WholesaleView = dynamic(() =>
  import("@/features/wholesale/view").then((m) => m.WholesaleView),
);
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
  ["Ventas mayoristas", Store],
  ["Base de datos", Database],
  ["Usuarios", Users],
  ["Configuración de pagos", QrCode],
] as const;
export default function Workspace({
  onLogout,
  loggingOut,
}: {
  onLogout: () => Promise<void>;
  loggingOut: boolean;
}) {
  const s = useApp();
  const [period, setPeriod] = useState("today");
  return (
    <SidebarProvider className="configor-shell">
      <Toaster richColors position="top-right" />
      <Sidebar className="brand-sidebar">
        <SidebarHeader>
          <div className="brand">
            <img
              src="/login-assets/logo-79db2d18040f.webp"
              width={88}
              height={88}
              alt="CONFIGOR Carnes"
            />
            <div className="brand-wordmark">
              CONFIGOR <span>CARNES</span>
            </div>
            <span className="brand-tagline">GESTIÓN & VENTAS</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <p className="nav-caption">TU ESPACIO DE TRABAJO</p>
          <Navigation s={s} />
        </SidebarContent>
        <SidebarFooter>
          <div className="scale-note">
            <span className="scanner-symbol">
              <ScanBarcode size={20} aria-hidden="true" />
            </span>
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
            <b aria-hidden="true">{s.admin ? "AD" : "VE"}</b>
            <div>
              {s.data?.user.name || "CONFIGOR Carnes"}
              <small>{s.admin ? "Administrador" : "Vendedor"}</small>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <div className="workspace">
        <header className="topbar">
          <div>
            <SidebarTrigger />
            <span className="workspace-breadcrumb">
              <b>CONFIGOR</b> <ChevronRight size={14} aria-hidden="true" />{" "}
              <span>{s.page}</span>
            </span>
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className="topbar-refresh"
              aria-label="Actualizar datos"
              title="Actualizar datos"
              onClick={() => s.load()}
            >
              <RefreshCw size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="logout-button"
              onClick={onLogout}
              disabled={loggingOut}
              aria-busy={loggingOut}
            >
              {loggingOut ? (
                <LoaderCircle
                  size={17}
                  className="animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <LogOut size={17} aria-hidden="true" />
              )}
              <span>{loggingOut ? "Cerrando…" : "Cerrar sesión"}</span>
            </button>
          </div>
        </header>
        <main>
          <div
            className={
              s.page === "Ventas mayoristas"
                ? "heading wholesale-heading"
                : "heading"
            }
          >
            <div>
              {s.page !== "Ventas mayoristas" && (
                <p className="eyebrow">
                  {s.page === "Punto de venta"
                    ? "CAJA · CONFIGOR CARNES"
                    : "CONTROL DE TU NEGOCIO"}
                </p>
              )}
              <h1>
                {s.page === "Resumen" ? "Tu negocio, en un vistazo." : s.page}
              </h1>
              {s.page !== "Ventas mayoristas" && (
                <p className="muted">
                  {
                    (
                      {
                        Resumen: "Cada corte cuenta. Cada venta también.",
                        "Punto de venta":
                          "Escanea, revisa y cobra. Así de simple.",
                        Ventas: "Cada transacción, con todos sus detalles.",
                        "Ventas mayoristas":
                          "Una atención cercana. Un historial para cada cliente.",
                        "Base de datos":
                          "Los productos de tu balanza, conectados con tu caja.",
                        Usuarios: "Cada persona, con el acceso que necesita.",
                        "Configuración de pagos":
                          "Tu QR y tus datos, listos para cada cobro.",
                      } as any
                    )[s.page]
                  }
                </p>
              )}
            </div>
            {s.page !== "Punto de venta" && s.page !== "Ventas mayoristas" && (
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
                  {s.admin ? (
                    <PeriodFilter s={s} period={period} setPeriod={setPeriod} />
                  ) : (
                    <span>Ventas de hoy · {today()}</span>
                  )}
                  <span>Operación en bolivianos · Bs</span>
                </div>
              )}
              {s.page === "Resumen" && s.admin && <Dashboard s={s} />}{" "}
              {s.page === "Punto de venta" && <POS s={s} />}{" "}
              {s.page === "Ventas mayoristas" && <WholesaleView s={s} />}
              {s.page === "Ventas" && (
                <section className="panel">
                  <div className="panel-title">
                    <h2>Historial · {s.visibleSales.length} ventas</h2>
                    <button className="secondary" onClick={s.exportSales}>
                      <Download size={16} /> Exportar CSV
                    </button>
                  </div>
                  <div className="sales-filters">
                    <div
                      className="sales-method-filter"
                      role="group"
                      aria-label="Filtrar por tipo de venta"
                    >
                      {[
                        ["all", "Todas"],
                        ["retail", "Al público"],
                        ["wholesale", "Mayoristas"],
                      ].map(([value, label]) => (
                        <button
                          type="button"
                          key={value}
                          aria-pressed={s.salesType === value}
                          onClick={() => s.setSalesType(value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div
                      className="sales-method-filter"
                      role="group"
                      aria-label="Filtrar por forma de pago"
                    >
                      {[
                        ["all", "Todos"],
                        ["cash", "Efectivo"],
                        ["qr", "QR"],
                        ["mixed", "Mixto"],
                      ].map(([value, label]) => (
                        <button
                          type="button"
                          key={value}
                          aria-pressed={s.salesMethod === value}
                          onClick={() => s.setSalesMethod(value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <SaleTable sales={s.visibleSales} onSelect={s.setSelected} />
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
            s.admin ||
            ["Punto de venta", "Ventas", "Ventas mayoristas"].includes(n) ||
            !s.data,
        )
        .map(([name, Icon]) => (
          <SidebarMenuItem key={name}>
            {name === "Base de datos" && (
              <p className="nav-section-label">ADMINISTRACIÓN</p>
            )}
            <SidebarMenuButton
              isActive={s.page === name}
              aria-current={s.page === name ? "page" : undefined}
              onClick={() => {
                s.setPage(name);
                s.setQuery("");
                setOpenMobile(false);
              }}
            >
              <span className="nav-icon">
                <Icon size={18} aria-hidden="true" />
              </span>
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
    } else if (value === "all") {
      s.setFrom("2000-01-01");
      s.setTo(current);
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
          <option value="all">Todo el historial</option>
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
