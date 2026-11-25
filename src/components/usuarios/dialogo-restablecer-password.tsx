"use client";

import { IconKey, IconLoader2 } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { restablecerPasswordUsuarioAction } from "@/app/(app)/usuarios/actions";
import { esquemaRestablecerPasswordUsuario } from "@/app/(app)/usuarios/esquemas";
import { FormField } from "@/components/formularios/form-card";
import {
  DialogoConfirmarDescarte,
  formularioTieneCambios,
} from "@/components/operaciones/dialogos-cartera";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { CampoPassword } from "./campo-password";
import type { UsuarioBasico } from "./tipos";

interface FormularioRestablecer {
  password: string;
  confirmado: boolean;
}

const FORMULARIO_INICIAL: FormularioRestablecer = {
  password: "",
  confirmado: false,
};

export interface DialogoRestablecerPasswordProps {
  abierto: boolean;
  usuario: UsuarioBasico | null;
  onOpenChange: (abierto: boolean) => void;
}

export function DialogoRestablecerPassword({
  abierto,
  usuario,
  onOpenChange,
}: DialogoRestablecerPasswordProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormularioRestablecer>(FORMULARIO_INICIAL);
  const [errorPassword, setErrorPassword] = useState<string | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  const enviandoRef = useRef(false);

  useEffect(() => {
    if (!abierto) {
      setConfirmandoDescarte(false);
      return;
    }

    setForm(FORMULARIO_INICIAL);
    setErrorPassword(null);
    setErrorGeneral(null);
    setGuardando(enviandoRef.current);
  }, [abierto]);

  const hayCambios = formularioTieneCambios(form, FORMULARIO_INICIAL);

  function solicitarCierre(
    siguienteAbierto: boolean,
    cancelarEvento?: () => void,
  ) {
    if (siguienteAbierto) {
      onOpenChange(true);
      return;
    }
    if (enviandoRef.current || guardando) {
      cancelarEvento?.();
      return;
    }
    if (hayCambios) {
      cancelarEvento?.();
      setConfirmandoDescarte(true);
      return;
    }
    onOpenChange(false);
  }

  function descartarCambios() {
    setConfirmandoDescarte(false);
    onOpenChange(false);
  }

  function actualizar<C extends keyof FormularioRestablecer>(
    campo: C,
    valor: FormularioRestablecer[C],
  ) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
    if (campo === "password") setErrorPassword(null);
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!usuario || enviandoRef.current || guardando) return;

    const validacion = esquemaRestablecerPasswordUsuario.safeParse({
      userId: usuario.userId,
      password: form.password,
    });

    if (!validacion.success) {
      setErrorPassword(
        validacion.error.issues[0]?.message ?? "Revisa la nueva contraseña.",
      );
      setErrorGeneral("Revisa la contraseña antes de confirmar.");
      return;
    }

    if (!form.confirmado) {
      setErrorGeneral(
        "Marca la confirmación para reemplazar la contraseña actual.",
      );
      return;
    }

    enviandoRef.current = true;
    setGuardando(true);
    setErrorGeneral(null);

    try {
      const resultado = await restablecerPasswordUsuarioAction(validacion.data);

      if (!resultado.ok) {
        setErrorGeneral(resultado.error);
        return;
      }

      toast.success(resultado.mensaje);
      onOpenChange(false);
      router.refresh();
    } catch {
      setErrorGeneral(
        "No pudimos restablecer la contraseña. Inténtalo de nuevo.",
      );
    } finally {
      enviandoRef.current = false;
      setGuardando(false);
    }
  }

  const nombreVisible =
    usuario === null || usuario.nombre.trim() === ""
      ? (usuario?.email ?? "")
      : `${usuario.nombre} · ${usuario.email}`;

  return (
    <Dialog
      open={abierto}
      onOpenChange={(siguienteAbierto, detalles) =>
        solicitarCierre(siguienteAbierto, () => detalles.cancel())
      }
    >
      <DialogContent className="sm:max-w-lg">
        <form className="flex flex-col gap-4" onSubmit={guardar} noValidate>
          <DialogHeader>
            <DialogTitle>Restablecer contraseña</DialogTitle>
            <DialogDescription>{nombreVisible}</DialogDescription>
          </DialogHeader>

          {errorGeneral ? (
            <p
              role="alert"
              className="rounded-[10px] border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {errorGeneral}
            </p>
          ) : null}

          <div className="rounded-[10px] border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-foreground">
            La contraseña actual dejará de funcionar de inmediato. Comparte la
            nueva clave por un canal seguro; no se enviará ningún correo.
          </div>

          <FormField
            htmlFor="restablecer-password-nueva"
            label="Nueva contraseña"
            required
            error={errorPassword ?? undefined}
          >
            <CampoPassword
              id="restablecer-password-nueva"
              valor={form.password}
              onCambio={(valor) => actualizar("password", valor)}
              deshabilitado={guardando}
              invalido={Boolean(errorPassword)}
              descritoPor={
                errorPassword
                  ? "restablecer-password-nueva-error"
                  : "restablecer-password-nueva-hint"
              }
            />
            <p
              id="restablecer-password-nueva-hint"
              className="text-xs text-muted-foreground"
            >
              Mínimo 12 caracteres. Puedes generar una clave segura de 16
              caracteres y copiarla.
            </p>
          </FormField>

          <label
            htmlFor="restablecer-password-confirmacion"
            className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-border bg-muted/50 px-3 py-2.5"
          >
            <Checkbox
              id="restablecer-password-confirmacion"
              checked={form.confirmado}
              onCheckedChange={(valor) => actualizar("confirmado", valor)}
              disabled={guardando}
              className="mt-0.5"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">
                Confirmo el restablecimiento
              </span>
              <span className="text-xs text-muted-foreground">
                Entiendo que la contraseña anterior será reemplazada.
              </span>
            </span>
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={guardando}
              onClick={() => solicitarCierre(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? (
                <>
                  <IconLoader2 className="size-4 animate-spin" />
                  Restableciendo…
                </>
              ) : (
                <>
                  <IconKey className="size-4" />
                  Restablecer contraseña
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <DialogoConfirmarDescarte
        abierto={confirmandoDescarte}
        onOpenChange={setConfirmandoDescarte}
        onDescartar={descartarCambios}
      />
    </Dialog>
  );
}
