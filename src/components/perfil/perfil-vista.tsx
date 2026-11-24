"use client";

import { IconCheck, IconLock, IconShieldCheck } from "@tabler/icons-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import {
  FormActions,
  FormCard,
  FormField,
} from "@/components/formularios/form-card";
import { ETIQUETAS_ROL, iniciales } from "@/components/shell/navegacion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ContextoApp } from "@/lib/auth/sesion";
import { createClient } from "@/lib/supabase/client";

const esquemaPassword = z
  .object({
    password: z
      .string()
      .min(12, "La contraseña debe tener al menos 12 caracteres."),
    confirmacion: z.string(),
  })
  .refine((v) => v.password === v.confirmacion, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmacion"],
  });

export function PerfilVista({ contexto }: { contexto: ContextoApp }) {
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const nombreVisible =
    contexto.perfil.nombre.trim() === ""
      ? contexto.perfil.email
      : contexto.perfil.nombre;
  const rolVisible = ETIQUETAS_ROL[contexto.rolActivo ?? "usuario"];

  async function cambiarPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const parsed = esquemaPassword.safeParse({ password, confirmacion });
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ?? "Revisa la contraseña ingresada.",
      );
      return;
    }

    setGuardando(true);
    try {
      const supabase = createClient();
      const { error: errAuth } = await supabase.auth.updateUser({
        password: parsed.data.password,
      });
      if (errAuth) {
        setError(errAuth.message);
        return;
      }
      setPassword("");
      setConfirmacion("");
      toast.success("Contraseña actualizada correctamente.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <FormCard>
        <div>
          <h2 className="font-display text-base font-bold text-foreground">
            Datos de tu cuenta
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Información de tu perfil y empresas con acceso habilitado.
          </p>
        </div>

        <div className="flex items-center gap-3.5">
          <Avatar size="lg">
            <AvatarFallback>{iniciales(nombreVisible)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-display truncate text-base font-bold text-foreground">
              {nombreVisible}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {contexto.perfil.email}
            </p>
            <Badge variant="secondary" className="mt-1.5">
              {rolVisible}
            </Badge>
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Empresas accesibles ({contexto.empresas.length})
          </p>
          {contexto.empresas.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Aún no hay empresas registradas.
            </p>
          ) : (
            <ul className="mt-2.5 flex flex-col gap-2">
              {contexto.empresas.map((emp) => (
                <li
                  key={emp.id}
                  className="flex items-center justify-between gap-2 rounded-[10px] border border-border bg-muted/30 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {emp.nombreComercial}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {ETIQUETAS_ROL[emp.rol]}
                    </p>
                  </div>
                  {emp.esPrincipal ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                      <IconCheck className="size-3" />
                      Principal
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </FormCard>

      <FormCard>
        <div>
          <h2 className="font-display text-base font-bold text-foreground">
            Seguridad y contraseña
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Actualiza tu contraseña personal de acceso (mínimo 12 caracteres).
          </p>
        </div>

        <form onSubmit={cambiarPassword} className="flex flex-col gap-4">
          <FormField
            label="Nueva contraseña"
            htmlFor="perfil-password"
            required
          >
            <Input
              id="perfil-password"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 12 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>

          <FormField
            label="Confirmar nueva contraseña"
            htmlFor="perfil-password-confirm"
            required
          >
            <Input
              id="perfil-password-confirm"
              type="password"
              autoComplete="new-password"
              placeholder="Repite la contraseña"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
            />
          </FormField>

          {error ? (
            <p className="rounded-[10px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-2 rounded-[10px] bg-secondary/60 px-3 py-2 text-xs text-secondary-foreground">
            <IconShieldCheck className="size-4 shrink-0" />
            <span>
              Tu cambio se aplica de inmediato en tu cuenta de Supabase Auth.
            </span>
          </div>

          <FormActions>
            <Button type="submit" disabled={guardando}>
              <IconLock className="size-4" />
              {guardando ? "Actualizando…" : "Actualizar contraseña"}
            </Button>
          </FormActions>
        </form>
      </FormCard>
    </div>
  );
}
