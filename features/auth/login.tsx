"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { LockNotice } from "./lock-notice";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  UserRound,
  ShieldCheck,
  ShoppingBag,
  LoaderCircle,
  CircleCheck,
} from "lucide-react";
import "./login.css";
const loadWorkspace = () => import("@/features/workspace/view");
const Workspace = dynamic(loadWorkspace);
export default function LocalEntry() {
  const [ready, setReady] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [role, setRole] = useState("admin"),
    [showPassword, setShowPassword] = useState(false),
    [username, setUsername] = useState(""),
    [locks, setLocks] = useState<Record<string, number>>({}),
    [success, setSuccess] = useState(false);
  const account = username.trim().toLowerCase();
  const root = useRef<HTMLDivElement>(null);
  const authRequest = useRef<Promise<Response> | null>(null);
  const onLockExpired = useCallback((key: string) => {
    setLocks((old) => {
      const next = { ...old };
      delete next[key];
      return next;
    });
  }, []);
  const remaining = Math.max(
    0,
    Math.ceil(((locks[account] || 0) - Date.now()) / 1000),
  );
  useEffect(() => {
    const visibility = () =>
      root.current?.classList.toggle("login-paused", document.hidden);
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [loading, ready]);
  useEffect(() => {
    let active = true;
    authRequest.current ??= fetch("/api/auth", {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    authRequest.current
      .then((r) => {
        if (active) setReady(r.ok);
      })
      .catch(() => {
        if (active) setError("No se pudo conectar con el servidor.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  if (loading)
    return (
      <div ref={root} className="premium-login login-loading">
        <img
          src="/login-assets/logo-79db2d18040f.webp"
          width={174}
          height={174}
          alt="CONFIGOR Carnes"
        />
        <p>
          <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />{" "}
          Abriendo CONFIGOR…
        </p>
      </div>
    );
  if (ready)
    return (
      <Workspace
        loggingOut={busy}
        onLogout={async () => {
          if (busy) return;
          if (
            !window.confirm(
              "¿Cerrar sesión? Los artículos sin cobrar no se guardarán.",
            )
          )
            return;
          setBusy(true);
          try {
            const response = await fetch("/api/auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "logout" }),
            });
            if (!response.ok)
              throw new Error(
                "No se pudo cerrar la sesión. Intenta nuevamente.",
              );
            setError("");
            setSuccess(false);
            setReady(false);
          } catch {
            const { toast } = await import("sonner");
            toast.error(
              "No se pudo cerrar la sesión. Revisa tu conexión e intenta nuevamente.",
            );
          } finally {
            setBusy(false);
          }
        }}
      />
    );
  return (
    <div ref={root} className="premium-login">
      <header className="login-masthead">
        <span>
          CONFIGOR <span className="masthead-light">CARNES</span>
        </span>
        <span className="masthead-caption">CALIDAD QUE NOS DISTINGUE</span>
      </header>
      <main className="login-shell">
        <section className="login-brand" aria-label="CONFIGOR Carnes">
          <div className="brand-photo" aria-hidden="true" />
          <div className="brand-content">
            <p className="brand-kicker">
              <span /> EL VALOR DE HACERLO BIEN
            </p>
            <div className="floating-emblem">
              <div className="emblem-orbit" aria-hidden="true" />
              <img
                src="/login-assets/logo-79db2d18040f.webp"
                width={174}
                height={174}
                decoding="async"
                alt="CONFIGOR Carnes"
              />
            </div>
            <div className="brand-story">
              <p className="brand-signature">PASIÓN POR LA CALIDAD</p>
              <h1>
                Cada detalle.
                <br />
                <em>Una gran diferencia.</em>
              </h1>
              <p>
                La calidad que nos define,
                <br />
                en cada corte y en cada venta.
              </p>
            </div>
            <div className="brand-seal">
              <span /> CALIDAD <b>◆</b> FRESCURA <b>◆</b> CONFIANZA <span />
            </div>
          </div>
        </section>
        <section className="login-access" aria-labelledby="login-title">
          <div className="access-heading">
            <span className="access-label">
              <span /> ACCESO AL SISTEMA
            </span>
            <span className="access-mark">C.</span>
          </div>
          <form
            className="premium-login-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy || remaining > 0) return;
              setBusy(true);
              setError("");
              const f = new FormData(e.currentTarget);
              try {
                const r = await fetch("/api/auth", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "login",
                    username: f.get("username"),
                    password: f.get("password"),
                    role,
                  }),
                });
                const d = await r.json();
                if (r.status === 429 && Number.isFinite(d.retryAfter)) {
                  const received = Date.now();
                  setLocks((old) => ({
                    ...old,
                    [String(f.get("username")).trim().toLowerCase()]:
                      received + d.retryAfter * 1000,
                  }));
                  setError("");
                  return;
                }
                if (!r.ok) throw Error(d.error);
                setLocks({});
                setSuccess(true);
                void loadWorkspace().catch(() => {});
                await new Promise((resolve) => window.setTimeout(resolve, 800));
                setReady(true);
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="login-overline">TU NEGOCIO, EN TUS MANOS</p>
            <h2 id="login-title">Bienvenido de nuevo.</h2>
            <p className="login-intro">
              Todo listo para un gran día.
              <br />
              Ingresa a tu espacio de trabajo.
            </p>
            <div
              className="premium-roles"
              role="group"
              aria-label="Rol de acceso"
            >
              <button
                type="button"
                aria-pressed={role === "admin"}
                disabled={busy}
                onClick={() => {
                  setRole("admin");
                  setError("");
                }}
              >
                <ShieldCheck size={17} aria-hidden="true" /> Administrador
              </button>
              <button
                type="button"
                aria-pressed={role === "cashier"}
                disabled={busy}
                onClick={() => {
                  setRole("cashier");
                  setError("");
                }}
              >
                <ShoppingBag size={17} aria-hidden="true" /> Vendedor
              </button>
            </div>
            <label className="premium-field">
              <span>Usuario</span>
              <div className="login-input-wrap">
                <UserRound size={18} aria-hidden="true" />
                <input
                  name="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError("");
                  }}
                  type="text"
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="Ingresa tu usuario"
                  disabled={busy}
                />
              </div>
            </label>
            <label className="premium-field">
              <span>Contraseña</span>
              <div className="login-input-wrap">
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  minLength={1}
                  maxLength={128}
                  required
                  autoComplete="current-password"
                  placeholder="Ingresa tu contraseña"
                  disabled={busy}
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {error && (
              <p role="alert" className="login-error">
                {error}
              </p>
            )}
            {remaining > 0 && (
              <LockNotice
                until={locks[account]}
                account={account}
                onExpired={onLockExpired}
              />
            )}
            {success && (
              <div className="login-success" role="status">
                <CircleCheck size={20} aria-hidden="true" />
                <span>¡Bien! Acceso correcto. Entrando a CONFIGOR…</span>
              </div>
            )}
            <button
              className="login-submit"
              disabled={busy || remaining > 0}
              aria-busy={busy}
            >
              {success
                ? "Acceso correcto"
                : remaining > 0
                  ? "Espera para volver a intentar"
                  : busy
                    ? "Verificando…"
                    : "Iniciar sesión"}
              {busy ? (
                <LoaderCircle
                  size={19}
                  className="animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <ArrowRight size={19} aria-hidden="true" />
              )}
            </button>
            <p className="login-private">
              <LockKeyhole size={13} aria-hidden="true" /> Acceso exclusivo para
              el equipo CONFIGOR
            </p>
          </form>
          <div className="access-footer">
            <span>VENTAS & ADMINISTRACIÓN</span>
            <span>CONFIGOR CARNES</span>
          </div>
        </section>
      </main>
      <footer className="login-page-footer">
        <span>
          CONFIGOR CARNES <b>·</b> Calidad, frescura y buen precio.
        </span>
        <span>HECHO PARA CRECER CONTIGO</span>
      </footer>
    </div>
  );
}
