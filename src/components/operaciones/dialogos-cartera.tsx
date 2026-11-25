"use client";

import { IconBan, IconLoader2, IconWallet } from "@tabler/icons-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/date-picker";
import { FormField } from "@/components/formularios/form-card";
import { SelectCampo } from "@/components/select-campo";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { aNumero, formatearMoneda, hoySantoDomingo } from "@/lib/formato";
import {
  anularDocumentoAction,
  anularPagoDocumentoAction,
  registrarPagoDocumentoAction,
} from "@/lib/operaciones/pagos-actions";
import type { CuentaOpcion, MetodoPagoOpcion } from "@/lib/operaciones/tipos";

export function formularioTieneCambios<T extends object>(
  actual: T,
  inicial: T,
): boolean {
  const campos = Object.keys(inicial) as (keyof T)[];
  return campos.some((campo) => actual[campo] !== inicial[campo]);
}

interface FormularioPago {
  fechaPago: string;
  monto: string;
  metodoPago: string;
  cuentaId: string;
  referencia: string;
}

interface FormularioAnulacion {
  fecha: string;
  motivo: string;
}

interface DialogoConfirmarDescarteProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  onDescartar: () => void;
}

export function DialogoConfirmarDescarte({
  abierto,
  onOpenChange,
  onDescartar,
}: DialogoConfirmarDescarteProps) {
  return (
    <AlertDialog open={abierto} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>¿Descartar cambios?</AlertDialogTitle>
          <AlertDialogDescription>
            Tienes cambios sin guardar. Si cierras ahora, se perderán.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Seguir editando</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDescartar}>
            Descartar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export interface DocumentoPago {
  id: string;
  numero: string;
  tercero: string;
  saldo: number;
}

export interface DialogoRegistrarPagoProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  empresaId: string;
  documento: DocumentoPago | null;
  cuentas: readonly CuentaOpcion[];
  metodosPago: readonly MetodoPagoOpcion[];
  etiquetaAccion: string;
  onRegistrado: () => void;
}

/**
 * Registra un cobro (CxC) o un pago (CxP) contra un documento. El asiento lo
 * crea `registrar_pago_documento` en la misma transacción del motor contable.
 */
export function DialogoRegistrarPago({
  abierto,
  onOpenChange,
  empresaId,
  documento,
  cuentas,
  metodosPago,
  etiquetaAccion,
  onRegistrado,
}: DialogoRegistrarPagoProps) {
  const [fechaPago, setFechaPago] = useState(hoySantoDomingo());
  const [monto, setMonto] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [referencia, setReferencia] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formReferencia, setFormReferencia] = useState<FormularioPago | null>(
    null,
  );
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  const enviandoRef = useRef(false);

  useEffect(() => {
    if (!abierto) {
      setConfirmandoDescarte(false);
      return;
    }

    const inicial: FormularioPago = {
      fechaPago: hoySantoDomingo(),
      monto: documento ? documento.saldo.toFixed(2) : "",
      metodoPago: metodosPago[0]?.nombre ?? "",
      cuentaId: metodosPago[0]?.cuentaId ?? "",
      referencia: "",
    };

    setFechaPago(inicial.fechaPago);
    setMonto(inicial.monto);
    setMetodoPago(inicial.metodoPago);
    setCuentaId(inicial.cuentaId);
    setReferencia(inicial.referencia);
    setFormReferencia(inicial);
    setError(null);
    setGuardando(enviandoRef.current);
  }, [abierto, documento, metodosPago]);

  const opcionesMetodos = metodosPago.map((metodo) => ({
    value: metodo.nombre,
    label: metodo.nombre,
  }));

  const opcionesCuentas = cuentas.map((cuenta) => ({
    value: cuenta.id,
    label: `${cuenta.codigo} · ${cuenta.nombre}`,
  }));

  const estadoActual: FormularioPago = {
    fechaPago,
    monto,
    metodoPago,
    cuentaId,
    referencia,
  };
  const hayCambios =
    formReferencia !== null &&
    formularioTieneCambios(estadoActual, formReferencia);

  function elegirMetodo(nombre: string) {
    setMetodoPago(nombre);
    const metodo = metodosPago.find((fila) => fila.nombre === nombre);
    if (metodo) setCuentaId(metodo.cuentaId);
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

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviandoRef.current || guardando || documento === null) return;

    const valor = aNumero(monto);

    if (valor <= 0) {
      setError("El monto debe ser mayor a cero.");
      return;
    }
    if (valor > documento.saldo + 0.005) {
      setError(
        `El monto no puede superar el saldo pendiente (${formatearMoneda(documento.saldo)}).`,
      );
      return;
    }
    if (metodoPago === "") {
      setError("Indica el método de pago.");
      return;
    }
    if (cuentaId === "") {
      setError("Selecciona la cuenta de banco o caja.");
      return;
    }

    setError(null);
    enviandoRef.current = true;
    setGuardando(true);

    try {
      const resultado = await registrarPagoDocumentoAction({
        empresaId,
        documentoId: documento.id,
        fechaPago,
        monto: valor,
        metodoPago,
        cuentaId,
        referencia,
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      toast.success(resultado.mensaje);
      setFormReferencia(estadoActual);
      onOpenChange(false);
      onRegistrado();
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
      <DialogContent className="sm:max-w-lg">
        <form className="flex flex-col gap-4" onSubmit={guardar} noValidate>
          <DialogHeader>
            <DialogTitle>{etiquetaAccion}</DialogTitle>
            <DialogDescription>
              {documento
                ? `${documento.numero} · ${documento.tercero} · saldo ${formatearMoneda(documento.saldo)}`
                : "Selecciona un documento."}
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <p
              role="alert"
              className="rounded-[10px] border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField htmlFor="pago-fecha" label="Fecha" required>
              <DatePicker
                id="pago-fecha"
                value={fechaPago}
                onChange={setFechaPago}
              />
            </FormField>

            <FormField htmlFor="pago-monto" label="Monto" required>
              <Input
                id="pago-monto"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={monto}
                onChange={(evento) => setMonto(evento.target.value)}
                className="tabular-nums"
              />
            </FormField>

            <FormField htmlFor="pago-metodo" label="Método de pago" required>
              <SelectCampo
                id="pago-metodo"
                opciones={opcionesMetodos}
                valor={metodoPago}
                onCambio={elegirMetodo}
                etiquetaVacia="Selecciona el método"
                requerido
                aria-label="Método de pago"
              />
            </FormField>

            <FormField htmlFor="pago-cuenta" label="Banco o caja" required>
              <SelectCampo
                id="pago-cuenta"
                opciones={opcionesCuentas}
                valor={cuentaId}
                onCambio={setCuentaId}
                etiquetaVacia="Selecciona la cuenta"
                buscable
                requerido
                aria-label="Cuenta de banco o caja"
              />
            </FormField>

            <FormField
              htmlFor="pago-referencia"
              label="Referencia"
              className="sm:col-span-2"
            >
              <Input
                id="pago-referencia"
                value={referencia}
                onChange={(evento) => setReferencia(evento.target.value)}
                placeholder="Cheque, transferencia, depósito…"
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
            <Button type="submit" disabled={guardando || documento === null}>
              {guardando ? (
                <>
                  <IconLoader2 className="size-4 animate-spin" />
                  Registrando…
                </>
              ) : (
                <>
                  <IconWallet className="size-4" />
                  {etiquetaAccion}
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

export interface DialogoAnularProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  empresaId: string;
  tipo: "documento" | "pago";
  referenciaId: string | null;
  identificador: string;
  onAnulado: () => void;
}

/** Anulación por reverso: nunca borra el documento ni su asiento. */
export function DialogoAnular({
  abierto,
  onOpenChange,
  empresaId,
  tipo,
  referenciaId,
  identificador,
  onAnulado,
}: DialogoAnularProps) {
  const [fecha, setFecha] = useState(hoySantoDomingo());
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formReferencia, setFormReferencia] =
    useState<FormularioAnulacion | null>(null);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  const enviandoRef = useRef(false);

  useEffect(() => {
    if (!abierto) {
      setConfirmandoDescarte(false);
      return;
    }

    const inicial: FormularioAnulacion = {
      fecha: hoySantoDomingo(),
      motivo: "",
    };

    setFecha(inicial.fecha);
    setMotivo(inicial.motivo);
    setFormReferencia(inicial);
    setError(null);
    setGuardando(enviandoRef.current);
  }, [abierto]);

  const estadoActual: FormularioAnulacion = { fecha, motivo };
  const hayCambios =
    formReferencia !== null &&
    formularioTieneCambios(estadoActual, formReferencia);

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

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviandoRef.current || guardando || referenciaId === null) return;

    if (motivo.trim().length < 3) {
      setError("Escribe el motivo de la anulación (mínimo 3 caracteres).");
      return;
    }

    setError(null);
    enviandoRef.current = true;
    setGuardando(true);

    try {
      const resultado =
        tipo === "pago"
          ? await anularPagoDocumentoAction({
              empresaId,
              pagoId: referenciaId,
              fechaAnulacion: fecha,
              motivo: motivo.trim(),
            })
          : await anularDocumentoAction({
              empresaId,
              documentoId: referenciaId,
              fechaAnulacion: fecha,
              motivo: motivo.trim(),
            });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      toast.success(resultado.mensaje);
      setFormReferencia(estadoActual);
      onOpenChange(false);
      onAnulado();
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
      <DialogContent className="sm:max-w-lg">
        <form className="flex flex-col gap-4" onSubmit={guardar} noValidate>
          <DialogHeader>
            <DialogTitle>
              {tipo === "pago" ? "Anular pago" : "Anular documento"}
            </DialogTitle>
            <DialogDescription>
              {tipo === "pago"
                ? `Se generará un asiento de reverso del pago ${identificador}.`
                : `Se generará un asiento de reverso del documento ${identificador}.`}
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <p
              role="alert"
              className="rounded-[10px] border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <FormField htmlFor="anular-fecha" label="Fecha de anulación" required>
            <DatePicker id="anular-fecha" value={fecha} onChange={setFecha} />
          </FormField>

          <FormField htmlFor="anular-motivo" label="Motivo" required>
            <Textarea
              id="anular-motivo"
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              placeholder="Motivo de la anulación"
              className="min-h-20"
            />
          </FormField>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={guardando}
              onClick={() => solicitarCierre(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={guardando || referenciaId === null}
            >
              {guardando ? (
                <>
                  <IconLoader2 className="size-4 animate-spin" />
                  Anulando…
                </>
              ) : (
                <>
                  <IconBan className="size-4" />
                  Anular con reverso
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
