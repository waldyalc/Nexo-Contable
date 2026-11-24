"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  IconAlertCircle,
  IconEye,
  IconEyeOff,
  IconLoader2,
  IconLock,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const esquema = z
  .object({
    password: z
      .string()
      .min(12, "La contraseña debe tener al menos 12 caracteres."),
    confirmar: z.string().min(1, "Confirma tu contraseña."),
  })
  .refine((datos) => datos.password === datos.confirmar, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmar"],
  });

type Formulario = z.infer<typeof esquema>;

export interface DefinirPasswordFormProps {
  nombre: string;
  email: string;
}

/**
 * Primer ingreso: el usuario define su contraseña personal y marca el perfil
 * como listo mediante `completar_definicion_password`.
 */
export function DefinirPasswordForm({
  nombre,
  email,
}: DefinirPasswordFormProps) {
  const router = useRouter();
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [verPassword, setVerPassword] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: { password: "", confirmar: "" },
  });

  async function alEnviar(datos: Formulario) {
    setErrorGeneral(null);
    setGuardando(true);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: datos.password,
    });

    if (error) {
      setErrorGeneral(
        "No pudimos guardar tu contraseña. Verifica que cumpla el mínimo de 12 caracteres.",
      );
      setGuardando(false);
      return;
    }

    const { error: errorRpc } = await supabase.rpc(
      "completar_definicion_password",
    );

    if (errorRpc) {
      setErrorGeneral(
        "Tu contraseña se actualizó, pero no pudimos cerrar el primer ingreso. Inténtalo de nuevo.",
      );
      setGuardando(false);
      return;
    }

    toast.success("Contraseña creada", {
      description: "Ya puedes entrar a la contabilidad de tus empresas.",
    });
    router.replace("/dashboard");
    router.refresh();
  }

  const saludo = nombre.trim() === "" ? email : nombre;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span className="flex size-10 items-center justify-center rounded-[12px] bg-secondary text-primary">
          <IconLock className="size-5" />
        </span>
        <h1 className="font-display text-2xl font-bold tracking-[-0.03em] text-foreground">
          Crea tu contraseña
        </h1>
        <p className="text-sm text-muted-foreground">
          Hola, {saludo}. Define una contraseña personal de al menos 12
          caracteres para terminar tu primer ingreso.
        </p>
      </header>

      {errorGeneral ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-[10px] border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <IconAlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{errorGeneral}</p>
        </div>
      ) : null}

      <form
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(alEnviar)}
        noValidate
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nueva-password">Nueva contraseña</Label>
          <div className="relative">
            <Input
              id="nueva-password"
              type={verPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Mínimo 12 caracteres"
              className="pr-10"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                errors.password ? "nueva-password-error" : "nueva-password-hint"
              }
              {...register("password")}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
              aria-label={
                verPassword ? "Ocultar contraseña" : "Mostrar contraseña"
              }
              onClick={() => setVerPassword((valor) => !valor)}
            >
              {verPassword ? (
                <IconEyeOff className="size-4" />
              ) : (
                <IconEye className="size-4" />
              )}
            </Button>
          </div>
          {errors.password ? (
            <p id="nueva-password-error" className="text-xs text-destructive">
              {errors.password.message}
            </p>
          ) : (
            <p
              id="nueva-password-hint"
              className="text-xs text-muted-foreground"
            >
              Usa mayúsculas, números y símbolos para una clave más segura.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmar-password">Confirmar contraseña</Label>
          <Input
            id="confirmar-password"
            type={verPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Repite tu contraseña"
            aria-invalid={Boolean(errors.confirmar)}
            aria-describedby={
              errors.confirmar ? "confirmar-password-error" : undefined
            }
            {...register("confirmar")}
          />
          {errors.confirmar ? (
            <p
              id="confirmar-password-error"
              className="text-xs text-destructive"
            >
              {errors.confirmar.message}
            </p>
          ) : null}
        </div>

        <Button
          type="submit"
          size="lg"
          className="h-10 w-full"
          disabled={guardando}
        >
          {guardando ? (
            <>
              <IconLoader2 className="size-4 animate-spin" />
              Guardando…
            </>
          ) : (
            "Guardar contraseña y entrar"
          )}
        </Button>
      </form>

      <p className="text-center text-xs leading-5 text-muted-foreground">
        Ingresaste como <span className="font-medium">{email}</span>. Si no
        reconoces esta cuenta, cierra la sesión y contacta al administrador.
      </p>
    </section>
  );
}
