"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
const Workspace = dynamic(() => import("@/features/workspace/view"));
export default function LocalEntry() {
  const [ready, setReady] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [role, setRole] = useState("admin");
  useEffect(() => {
    fetch("/api/auth")
      .then((r) => setReady(r.ok))
      .catch(() => setError("No se pudo conectar con el servidor."))
      .finally(() => setLoading(false));
  }, []);
  if (loading)
    return (
      <div className="local-login">
        <p>Abriendo CONFIGOR…</p>
      </div>
    );
  if (ready)
    return (
      <>
        <div className="local-session">
          <span>CONFIGOR · Sistema de ventas</span>
          <button
            onClick={async () => {
              if (
                !window.confirm(
                  "¿Cerrar sesión? Los artículos sin cobrar no se guardarán.",
                )
              )
                return;
              await fetch("/api/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "logout" }),
              });
              setReady(false);
            }}
          >
            Cerrar sesión
          </button>
        </div>
        <Workspace />
      </>
    );
  return (
    <div className="local-login">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
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
            if (!r.ok) throw Error(d.error);
            setReady(true);
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <img src="/configor-logo.jpg" alt="CONFIGOR Carnes" />
        <p className="eyebrow">SISTEMA DE VENTAS</p>
        <h1>Bienvenido a CONFIGOR</h1>
        <p className="hint">Selecciona tu rol e ingresa con tu usuario.</p>
        <div className="login-roles" role="group" aria-label="Rol de acceso">
          <button
            type="button"
            aria-pressed={role === "admin"}
            onClick={() => {
              setRole("admin");
              setError("");
            }}
          >
            Administrador
          </button>
          <button
            type="button"
            aria-pressed={role === "cashier"}
            onClick={() => {
              setRole("cashier");
              setError("");
            }}
          >
            Vendedor
          </button>
        </div>
        <label className="field">
          Usuario
          <input
            name="username"
            type="text"
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
          />
        </label>
        <label className="field">
          Contraseña
          <input
            name="password"
            type="password"
            minLength={8}
            maxLength={128}
            required
            autoComplete="current-password"
          />
        </label>
        {error && (
          <p role="alert" className="error-banner">
            {error}
          </p>
        )}
        <button className="primary wide" disabled={busy}>
          {busy ? "Ingresando…" : "Iniciar sesión"}
        </button>
      </form>
    </div>
  );
}
