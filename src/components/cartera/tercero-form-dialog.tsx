"use client";

import { IconLoader2, IconSearch, IconUserPlus } from "@tabler/icons-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  type EntradaTercero,
  guardarTerceroAction,
} from "@/app/(app)/gastos/terceros-actions";
import { FormField } from "@/components/formularios/form-card";
import {
  DialogoConfirmarDescarte,
  formularioTieneCambios,
} from "@/components/operaciones/dialogos-cartera";
import { SelectCampo } from "@/components/select-campo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { DatosContribuyenteDgii } from "@/lib/dgii/consulta";
import { normalizarRnc } from "@/lib/formato";
import type { TerceroListado, TipoTercero } from "@/lib/operaciones/tipos";

const OPCIONES_TIPO = [
  { value: "customer", label: "Cliente" },
  { value: "supplier", label: "Suplidor" },
  { value: "both", label: "Cliente y suplidor" },
];

type RespuestaDgii =
  | { ok: true; datos: DatosContribuyenteDgii }
  | { ok: false; error: string; mensaje: string };

interface FormTercero {
  tipo: TipoTercero;
  nombre: string;
  rnc: string;
  correo: string;
  telefono: string;
  direccion: string;
  cuentaPorPagarId: string;
  cuentaPorCobrarId: string;
  activo: boolean;
}

function formInicial(
  tercero: TerceroListado | null,
  tipoInicial: TipoTercero,
): FormTercero {
  if (!tercero) {
    return {
      tipo: tipoInicial,
      nombre: "",
      rnc: "",
      correo: "",
      telefono: "",
      direccion: "",
      cuentaPorPagarId: "",
      cuentaPorCobrarId: "",
      activo: true,
    };
  }

  return {
    tipo: tercero.tipo,
    nombre: tercero.nombre,
    rnc: tercero.rnc,
    correo: tercero.correo,
    telefono: tercero.telefono,
    direccion: tercero.direccion,
    cuentaPorPagarId: tercero.cuentaPorPagarId ?? "",
    cuentaPorCobrarId: tercero.cuentaPorCobrarId ?? "",
    activo: tercero.activo,
  };
}

export interface TerceroFormDialogProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  empresaId: string;
  tercero: TerceroListado | null;
  tipoInicial: TipoTercero;
  onGuardado: () => void;
}

/** Alta y modificación directa de terceros, con el flujo corto del Nexo original. */
export function TerceroFormDialog({
  abierto,
  onOpenChange,
  empresaId,
  tercero,
  tipoInicial,
  onGuardado,
}: TerceroFormDialogProps) {
  const [form, setForm] = useState<FormTercero>(
    formInicial(tercero, tipoInicial),
  );
  const [formReferencia, setFormReferencia] = useState<FormTercero>(form);
  const [guardando, setGuardando] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [errorNombre, setErrorNombre] = useState<string | null>(null);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  const enviandoRef = useRef(false);

  useEffect(() => {
    if (!abierto) {
      setConfirmandoDescarte(false);
      return;
    }

    const inicial = formInicial(tercero, tipoInicial);
    setForm(inicial);
    setFormReferencia(inicial);
    setErrorGeneral(null);
    setErrorNombre(null);
    setGuardando(enviandoRef.current);
  }, [abierto, tercero, tipoInicial]);

  const hayCambios = formularioTieneCambios(form, formReferencia);
  const editando = tercero !== null;

  function actualizar<C extends keyof FormTercero>(
    campo: C,
    valor: FormTercero[C],
  ) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  }

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

  async function consultarDgii() {
    const numero = normalizarRnc(form.rnc);
    if (numero === "") {
      toast.error("Escribe el RNC o la cédula antes de consultar.");
      return;
    }

    setConsultando(true);
    try {
      const respuesta = await fetch(
        `/api/dgii/rnc?numero=${encodeURIComponent(numero)}`,
      );
      const cuerpo = (await respuesta.json()) as RespuestaDgii;

      if (!cuerpo.ok) {
        toast.error(cuerpo.mensaje);
        return;
      }

      if (form.nombre.trim() === "") {
        setForm((anterior) => ({ ...anterior, nombre: cuerpo.datos.nombre }));
      }
      toast.success("Contribuyente encontrado en la DGII", {
        description: cuerpo.datos.nombre,
      });
    } catch {
      toast.error("No pudimos consultar la DGII. Revisa tu conexión.");
    } finally {
      setConsultando(false);
    }
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviandoRef.current || guardando) return;

    if (form.nombre.trim() === "") {
      setErrorNombre("El nombre del tercero es obligatorio.");
      return;
    }

    setErrorNombre(null);
    setErrorGeneral(null);
    enviandoRef.current = true;
    setGuardando(true);

    const entrada: EntradaTercero = {
      empresaId,
      id: tercero?.id ?? null,
      tipo: form.tipo,
      nombre: form.nombre.trim(),
      rnc: form.rnc,
      correo: form.correo,
      telefono: form.telefono,
      direccion: form.direccion,
      cuentaPorPagarId:
        form.cuentaPorPagarId === "" ? null : form.cuentaPorPagarId,
      cuentaPorCobrarId:
        form.cuentaPorCobrarId === "" ? null : form.cuentaPorCobrarId,
      activo: form.activo,
    };

    try {
      const resultado = await guardarTerceroAction(entrada);
      if (!resultado.ok) {
        setErrorGeneral(resultado.error);
        return;
      }

      toast.success(resultado.mensaje);
      setFormReferencia(form);
      onOpenChange(false);
      onGuardado();
    } finally {
      enviandoRef.current = false;
      setGuardando(false);
    }
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(siguienteAbierto, detalles) =>
        solicitarCierre(siguienteAbierto, () => detalles.cancel())
      }
    >
      <DialogContent className="sm:max-w-xl">
        <form className="flex flex-col gap-4" onSubmit={guardar} noValidate>
          <DialogHeader>
            <DialogTitle>
              {editando ? "Modificar tercero" : "Registrar tercero"}
            </DialogTitle>
            <DialogDescription>
              Clientes y proveedores compartidos por facturación, compras y
              cartera.
            </DialogDescription>
          </DialogHeader>

          {errorGeneral ? (
            <p
              role="alert"
              className="rounded-[10px] border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {errorGeneral}
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField htmlFor="cartera-tercero-tipo" label="Tipo" required>
              <SelectCampo
                id="cartera-tercero-tipo"
                opciones={OPCIONES_TIPO}
                valor={form.tipo}
                onCambio={(valor) =>
                  actualizar(
                    "tipo",
                    valor === "customer" || valor === "supplier"
                      ? valor
                      : "both",
                  )
                }
                requerido
                aria-label="Tipo de tercero"
              />
            </FormField>

            <FormField
              htmlFor="cartera-tercero-nombre"
              label="Nombre o razón social"
              required
              error={errorNombre ?? undefined}
            >
              <Input
                id="cartera-tercero-nombre"
                value={form.nombre}
                onChange={(evento) => actualizar("nombre", evento.target.value)}
                placeholder="Ej. Distribuidora Nacional SRL"
                aria-invalid={Boolean(errorNombre)}
              />
            </FormField>

            <FormField
              htmlFor="cartera-tercero-rnc"
              label="RNC / identificación"
            >
              <div className="flex items-center gap-2">
                <Input
                  id="cartera-tercero-rnc"
                  value={form.rnc}
                  onChange={(evento) => actualizar("rnc", evento.target.value)}
                  placeholder="Escribe el RNC y consulta la DGII"
                  inputMode="numeric"
                  className="min-w-0"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 shrink-0 whitespace-nowrap"
                  disabled={consultando || guardando}
                  onClick={() => void consultarDgii()}
                >
                  {consultando ? (
                    <IconLoader2 className="size-4 animate-spin" />
                  ) : (
                    <IconSearch className="size-4" />
                  )}
                  DGII
                </Button>
              </div>
            </FormField>

            <FormField htmlFor="cartera-tercero-correo" label="Correo">
              <Input
                id="cartera-tercero-correo"
                type="email"
                value={form.correo}
                onChange={(evento) => actualizar("correo", evento.target.value)}
                placeholder="contacto@empresa.com"
              />
            </FormField>

            <FormField htmlFor="cartera-tercero-telefono" label="Teléfono">
              <Input
                id="cartera-tercero-telefono"
                value={form.telefono}
                onChange={(evento) =>
                  actualizar("telefono", evento.target.value)
                }
                placeholder="809-000-0000"
              />
            </FormField>
          </div>

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
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconUserPlus className="size-4" />
              )}
              {editando ? "Guardar cambios" : "Guardar tercero"}
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
