"use client";
import { useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";

// Only this small notice updates each second, and only while visible and locked.
export function LockNotice({
  until,
  account,
  onExpired,
}: {
  until: number;
  account: string;
  onExpired: (account: string) => void;
}) {
  const [seconds, setSeconds] = useState(() =>
    Math.max(0, Math.ceil((until - Date.now()) / 1000)),
  );
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      clearInterval(timer);
      timer = undefined;
    };
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setSeconds(remaining);
      if (!remaining) {
        stop();
        onExpired(account);
      }
      return remaining;
    };
    const resume = () => {
      stop();
      if (!document.hidden && tick() > 0) timer = setInterval(tick, 1000);
    };
    resume();
    document.addEventListener("visibilitychange", resume);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", resume);
    };
  }, [until, account, onExpired]);
  const countdown = `${seconds >= 3600 ? `${Math.floor(seconds / 3600)}:` : ""}${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <div className="login-lock" role="status">
      <LockKeyhole size={18} aria-hidden="true" />
      <div>
        <strong>Acceso bloqueado temporalmente</strong>
        <p>
          Demasiados intentos incorrectos. Podrás volver a intentar en{" "}
          <b aria-live="off">{countdown}</b>.
        </p>
      </div>
    </div>
  );
}
