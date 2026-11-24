"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  IconAlertCircle,
  IconEye,
  IconEyeOff,
  IconLoader2,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const MENSAJES_CODIGO: Record<string, string> = {
  "no-autorizado":
    "Tu cuenta no está autorizada. Solicita acceso al administrador de tu firma.",
  inactivo: "Tu cuenta está inactiva. Contacta al administrador de tu firma.",
  auth: "No pudimos completar el inicio de sesión. Inténtalo de nuevo.",
};

const esquema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Ingresa tu correo.")
    .email("Ingresa un correo válido."),
  password: z.string().min(1, "Ingresa tu contraseña."),
});

type Formulario = z.infer<typeof esquema>;

function mensajeDeError(mensaje: string): string {
  const normalizado = mensaje.toLowerCase();

  if (normalizado.includes("invalid login credentials")) {
    return "Correo o contraseña incorrectos.";
  }
  if (normalizado.includes("email not confirmed")) {
    return "Tu correo aún no está confirmado. Contacta al administrador.";
  }
  if (normalizado.includes("rate limit")) {
    return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
  }
  if (normalizado.includes("network")) {
    return "No pudimos conectar con el servidor. Revisa tu conexión.";
  }

  return "No pudimos iniciar sesión. Inténtalo de nuevo.";
}

function IconoGoogle() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.86c2.26-2.09 3.56-5.17 3.56-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

export interface LoginFormProps {
  /** Código devuelto por `/auth/callback` o por el proxy (`no-autorizado`, `inactivo`…). */
  codigoError?: string;
}

/**
 * Formulario de ingreso de Nexo: Google OAuth + correo y contraseña.
 * No existe registro público: las cuentas las aprovisiona un administrador.
 */
export function LoginForm({ codigoError }: LoginFormProps) {
  const router = useRouter();
  const [errorGeneral, setErrorGeneral] = useState<string | null>(
    codigoError
      ? (MENSAJES_CODIGO[codigoError] ??
          "No pudimos completar el inicio de sesión. Inténtalo de nuevo.")
      : null,
  );
  const [verPassword, setVerPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [cargandoGoogle, setCargandoGoogle] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: { email: "", password: "" },
  });

  async function alEnviar(datos: Formulario) {
    setErrorGeneral(null);
    setCargando(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: datos.email.trim(),
      password: datos.password,
    });

    if (error) {
      setErrorGeneral(mensajeDeError(error.message));
      setCargando(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  async function continuarConGoogle() {
    setErrorGeneral(null);
    setCargandoGoogle(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setErrorGeneral(
        "No pudimos abrir el ingreso con Google. Inténtalo de nuevo.",
      );
      setCargandoGoogle(false);
    }
  }

  const ocupado = cargando || cargandoGoogle;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl font-bold tracking-[-0.03em] text-foreground">
          Inicia sesión
        </h1>
        <p className="text-sm text-muted-foreground">
          Accede a la contabilidad de tus empresas con tu cuenta autorizada.
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

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-10 w-full justify-center gap-2.5 border-border bg-card text-foreground"
        disabled={ocupado}
        onClick={continuarConGoogle}
      >
        {cargandoGoogle ? (
          <IconLoader2 className="size-4 animate-spin" />
        ) : (
          <IconoGoogle />
        )}
        Continuar con Google
      </Button>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">
          o ingresa con tu correo
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(alEnviar)}
        noValidate
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="login-email">Correo electrónico</Label>
          <Input
            id="login-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="nombre@empresa.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "login-email-error" : undefined}
            {...register("email")}
          />
          {errors.email ? (
            <p id="login-email-error" className="text-xs text-destructive">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="login-password">Contraseña</Label>
          <div className="relative">
            <Input
              id="login-password"
              type={verPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••••••"
              className="pr-10"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                errors.password ? "login-password-error" : undefined
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
            <p id="login-password-error" className="text-xs text-destructive">
              {errors.password.message}
            </p>
          ) : null}
        </div>

        <Button
          type="submit"
          size="lg"
          className="h-10 w-full"
          disabled={ocupado}
        >
          {cargando ? (
            <>
              <IconLoader2 className="size-4 animate-spin" />
              Ingresando…
            </>
          ) : (
            "Iniciar sesión"
          )}
        </Button>
      </form>

      <p className="text-center text-xs leading-5 text-muted-foreground">
        ¿No tienes acceso? El administrador de tu firma crea las cuentas. No hay
        registro público.
      </p>
    </section>
  );
}
