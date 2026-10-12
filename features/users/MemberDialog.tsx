"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Switch } from "@/components/ui/switch";

import { Choice } from "@/components/shared/tables";

import type { AppState } from "@/features/workspace/use-workspace";

export default function MemberDialog({ s }: { s: AppState }) {
  return (
    <Dialog
      open={!!s.member}
      onOpenChange={(v) => {
        if (!v) s.setMember(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Usuario de CONFIGOR</DialogTitle>
          <DialogDescription>
            Asigna los permisos de acceso del equipo.
          </DialogDescription>
        </DialogHeader>
        {s.member && (
          <>
            <label className="field">
              Nombre
              <input
                value={s.member.name}
                onChange={(e) =>
                  s.setMember({ ...s.member!, name: e.target.value })
                }
              />
            </label>
            <label className="field">
              Usuario de inicio de sesión
              <input
                type="text"
                value={s.member.email}
                onChange={(e) =>
                  s.setMember({ ...s.member!, email: e.target.value })
                }
              />
            </label>
            <label className="field">
              Contraseña (mínimo 8 caracteres; vacía para conservar)
              <input
                type="password"
                autoComplete="new-password"
                value={s.member.password || ""}
                onChange={(e) =>
                  s.setMember({ ...s.member!, password: e.target.value })
                }
              />
            </label>
            <Choice
              value={s.member.role}
              onChange={(role) => s.setMember({ ...s.member!, role })}
              label="Rol"
              options={[
                ["cashier", "Vendedor"],
                ["admin", "Administrador"],
              ]}
            />
            <label className="switch-label">
              <Switch
                checked={!!s.member.active}
                onCheckedChange={(active) =>
                  s.setMember({ ...s.member!, active: active ? 1 : 0 })
                }
              />{" "}
              Usuario activo
            </label>
            <button
              disabled={s.busy}
              className="primary"
              onClick={async () => {
                if (
                  await s.run(
                    { action: "member", member: s.member },
                    "Usuario guardado",
                  )
                )
                  s.setMember(null);
              }}
            >
              Guardar usuario
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
