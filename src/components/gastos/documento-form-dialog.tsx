"use client";

import {
  IconFileInvoice,
  IconLoader2,
  IconReceipt2,
} from "@tabler/icons-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { emitirDocumentoVentaAction } from "@/app/(app)/facturacion/actions";
import { emitirDocumentoCompraAction } from "@/app/(app)/gastos/actions";
import { DatePicker } from "@/components/date-picker";
import { FormField, FormGrid } from "@/components/formularios/form-card";
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
import { aNumero, formatearMoneda, hoySantoDomingo } from "@/lib/formato";
import { cuentasParaCampoDocumento } from "@/lib/operaciones/cuentas-opciones";
import {
  type CuentaOpcion,
  type DocumentoAcreditable,
  type EntradaDocumento,
  type SecuenciaNcfListado,
  TIPOS_COMPROBANTE_DGII,
  type TerceroListado,
} from "@/lib/operaciones/tipos";

export type ModoDocumento =
  | "compra"
  | "venta"
  | "nota_credito_compra"
  | "nota_credito_venta";

interface FormDocumento {
  terceroId: string;
  fechaEmision: string;
  fechaVencimiento: string;
  concepto: string;
  subtotal: string;
  impuesto: string;
  retencionIsr: string;
  retencionItbis: string;
  cuentaId: string;
  cuentaControlId: string;
  cuentaImpuestoId: string;
  cuentaRetencionId: string;
  tipoNcf: string;
  ncf: string;
  documentoAcreditadoId: string;
}

export interface DocumentoFormDialogProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  empresaId: string;
  modo: ModoDocumento;
  terceros: readonly TerceroListado[];
  cuentas: readonly CuentaOpcion[];
  secuencias: readonly SecuenciaNcfListado[];
  documentosAcreditables: readonly DocumentoAcreditable[];
  tasaItbisBps: number;
  cuentaControlDefaultId: string | null;
}

function esVenta(modo: ModoDocumento): boolean {
  return modo === "venta" || modo === "nota_credito_venta";
}

function esNota(modo: ModoDocumento): boolean {
  return modo === "nota_credito_compra" || modo === "nota_credito_venta";
}

function opcionesDeCuentas(cuentas: readonly CuentaOpcion[]) {
  return cuentas.map((cuenta) => ({
    value: cuenta.id,
    label: `${cuenta.codigo} · ${cuenta.nombre}`,
  }));
}

function tipoDocumento(modo: ModoDocumento): EntradaDocumento["tipo"] {
  if (modo === "compra") return "purchase_invoice";
  if (modo === "venta") return "sales_invoice";
  if (modo === "nota_credito_compra") return "purchase_credit";
  return "sales_credit";
}

function tituloModo(modo: ModoDocumento): string {
  if (modo === "compra") return "Nueva compra";
  if (modo === "venta") return "Nueva factura";
  if (modo === "nota_credito_compra") return "Nueva nota de crédito de compra";
  return "Nueva nota de crédito de venta";
}

function formInicial(
  modo: ModoDocumento,
  cuentaControlDefaultId: string | null,
  tipoNcfInicial: string,
): FormDocumento {
  return {
    terceroId: "",
    fechaEmision: hoySantoDomingo(),
    fechaVencimiento: "",
    concepto: "",
    subtotal: "",
    impuesto: "",
    retencionIsr: "",
    retencionItbis: "",
    cuentaId: "",
    cuentaControlId: cuentaControlDefaultId ?? "",
    cuentaImpuestoId: "",
    cuentaRetencionId: "",
    tipoNcf: esVenta(modo) ? tipoNcfInicial : "",
    ncf: "",
    documentoAcreditadoId: "",
  };
}

/**
 * Formulario de emisión reutilizable por Compras, Facturación y notas de
 * crédito. Nunca calcula asientos: solo envía importes y la RPC del motor
 * contable hace la partida doble, el período y el consumo atómico del NCF.
 */
export function DocumentoFormDialog({
  abierto,
  onOpenChange,
  empresaId,
  modo,
  terceros,
  cuentas,
  secuencias,
  documentosAcreditables,
  tasaItbisBps,
  cuentaControlDefaultId,
}: DocumentoFormDialogProps) {
  const venta = esVenta(modo);
  const nota = esNota(modo);
  const operacionDocumento = venta ? "venta" : "compra";

  const secuenciasDisponibles = useMemo(() => {
    const mapa = new Map<string, SecuenciaNcfListado>();
    for (const secuencia of secuencias) {
      if (!secuencia.activo) continue;
      if (secuencia.numeroActual >= secuencia.numeroFinal) continue;
      if (!mapa.has(secuencia.tipoComprobante)) {
        mapa.set(secuencia.tipoComprobante, secuencia);
      }
    }
    return [...mapa.values()];
  }, [secuencias]);

  const [form, setForm] = useState<FormDocumento>(
    formInicial(
      modo,
      cuentaControlDefaultId,
      secuenciasDisponibles[0]?.tipoComprobante ?? "",
    ),
  );
  const [ncfManual, setNcfManual] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setForm(
      formInicial(
        modo,
        cuentaControlDefaultId,
        secuenciasDisponibles[0]?.tipoComprobante ?? "",
      ),
    );
    setNcfManual(secuenciasDisponibles.length === 0 && venta);
    setErrorGeneral(null);
    setGuardando(false);
  }, [abierto, modo, cuentaControlDefaultId, secuenciasDisponibles, venta]);

  const opcionesTerceros = useMemo(
    () =>
      terceros
        .filter((tercero) => {
          if (!tercero.activo) return false;
          if (venta)
            return tercero.tipo === "customer" || tercero.tipo === "both";
          return tercero.tipo === "supplier" || tercero.tipo === "both";
        })
        .map((tercero) => ({
          value: tercero.id,
          label:
            tercero.rnc === ""
              ? tercero.nombre
              : `${tercero.nombre} · ${tercero.rnc}`,
        })),
    [terceros, venta],
  );

  const opcionesCuentaPrincipal = useMemo(
    () =>
      opcionesDeCuentas(
        cuentasParaCampoDocumento(cuentas, operacionDocumento, "principal"),
      ),
    [cuentas, operacionDocumento],
  );

  const opcionesCuentaControl = useMemo(
    () =>
      opcionesDeCuentas(
        cuentasParaCampoDocumento(cuentas, operacionDocumento, "control"),
      ),
    [cuentas, operacionDocumento],
  );

  const opcionesCuentaImpuesto = useMemo(
    () =>
      opcionesDeCuentas(
        cuentasParaCampoDocumento(cuentas, operacionDocumento, "impuesto"),
      ),
    [cuentas, operacionDocumento],
  );

  const opcionesCuentaRetencion = useMemo(
    () =>
      opcionesDeCuentas(
        cuentasParaCampoDocumento(cuentas, operacionDocumento, "retencion"),
      ),
    [cuentas, operacionDocumento],
  );

  const opcionesSecuencias = useMemo(
    () =>
      secuenciasDisponibles.map((secuencia) => ({
        value: secuencia.tipoComprobante,
        label: `${secuencia.prefijo} · ${secuencia.tipoComprobante} (${secuencia.numeroFinal - secuencia.numeroActual} disponibles)`,
      })),
    [secuenciasDisponibles],
  );

  const opcionesTipoNcf = useMemo(
    () => TIPOS_COMPROBANTE_DGII.map((tipo) => ({ value: tipo, label: tipo })),
    [],
  );

  const opcionesAcreditables = useMemo(
    () =>
      documentosAcreditables.map((documento) => ({
        value: documento.id,
        label: `${documento.numero} · ${documento.tercero} · saldo ${formatearMoneda(documento.saldo)}`,
      })),
    [documentosAcreditables],
  );

  const subtotal = aNumero(form.subtotal);
  const impuesto = aNumero(form.impuesto);
  const retenciones = aNumero(form.retencionIsr) + aNumero(form.retencionItbis);
  const total = Math.max(subtotal + impuesto - retenciones, 0);
  const acreditado =
    documentosAcreditables.find(
      (documento) => documento.id === form.documentoAcreditadoId,
    ) ?? null;

  function actualizar<C extends keyof FormDocumento>(
    campo: C,
    valor: FormDocumento[C],
  ) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  }

  function cambiarSubtotal(valor: string) {
    setForm((anterior) => {
      const nuevoSubtotal = aNumero(valor);
      const itbisSugerido = ((nuevoSubtotal * tasaItbisBps) / 10_000).toFixed(
        2,
      );
      const impuestoActual = aNumero(anterior.impuesto);
      const subtotalAnterior = aNumero(anterior.subtotal);
      const itbisAnterior = (
        (subtotalAnterior * tasaItbisBps) /
        10_000
      ).toFixed(2);
      const mantenerImpuesto =
        anterior.impuesto !== "" && impuestoActual.toFixed(2) !== itbisAnterior;

      return {
        ...anterior,
        subtotal: valor,
        impuesto:
          mantenerImpuesto || tasaItbisBps === 0
            ? anterior.impuesto
            : itbisSugerido,
      };
    });
  }

  function elegirAcreditado(id: string) {
    const documento = documentosAcreditables.find((fila) => fila.id === id);
    setForm((anterior) => ({
      ...anterior,
      documentoAcreditadoId: id,
      terceroId: documento?.terceroId ?? anterior.terceroId,
      concepto:
        anterior.concepto === "" && documento
          ? `Nota de crédito sobre ${documento.numero}`
          : anterior.concepto,
    }));
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;

    const faltantes: string[] = [];
    if (form.terceroId === "") faltantes.push("el tercero");
    if (form.concepto.trim() === "") faltantes.push("el concepto");
    if (subtotal <= 0) faltantes.push("un subtotal mayor a cero");
    if (form.cuentaId === "") faltantes.push("la cuenta contable");
    if (form.cuentaControlId === "") faltantes.push("la cuenta de control");
    if (impuesto > 0 && form.cuentaImpuestoId === "") {
      faltantes.push("la cuenta de impuesto");
    }
    if (retenciones > 0 && form.cuentaRetencionId === "") {
      faltantes.push("la cuenta de retención");
    }
    if (nota && form.documentoAcreditadoId === "") {
      faltantes.push("el documento acreditado");
    }
    if (venta) {
      if (ncfManual && form.ncf.trim() === "") faltantes.push("el NCF manual");
      if (!ncfManual && form.tipoNcf === "")
        faltantes.push("una secuencia NCF");
    } else if (form.ncf.trim() === "") {
      faltantes.push("el NCF del proveedor");
    }

    if (faltantes.length > 0) {
      setErrorGeneral(`Falta ${faltantes.join(", ")}.`);
      return;
    }

    setErrorGeneral(null);
    setGuardando(true);

    const entrada: EntradaDocumento = {
      empresaId,
      tipo: tipoDocumento(modo),
      terceroId: form.terceroId,
      fechaEmision: form.fechaEmision,
      fechaVencimiento:
        form.fechaVencimiento === "" ? null : form.fechaVencimiento,
      concepto: form.concepto.trim(),
      cuentaId: form.cuentaId,
      cuentaControlId: form.cuentaControlId,
      cuentaImpuestoId:
        form.cuentaImpuestoId === "" ? null : form.cuentaImpuestoId,
      cuentaRetencionId:
        form.cuentaRetencionId === "" ? null : form.cuentaRetencionId,
      subtotal,
      impuesto,
      retencionIsr: aNumero(form.retencionIsr),
      retencionItbis: aNumero(form.retencionItbis),
      tipoNcf: form.tipoNcf,
      ncf: form.ncf.trim() === "" ? "" : form.ncf.trim().toUpperCase(),
      documentoAcreditadoId:
        form.documentoAcreditadoId === "" ? null : form.documentoAcreditadoId,
    };

    const resultado = venta
      ? await emitirDocumentoVentaAction(entrada)
      : await emitirDocumentoCompraAction(entrada);

    setGuardando(false);

    if (!resultado.ok) {
      setErrorGeneral(resultado.error);
      return;
    }

    toast.success(resultado.mensaje);
    onOpenChange(false);
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <form className="flex flex-col gap-4" onSubmit={guardar} noValidate>
          <DialogHeader>
            <DialogTitle>{tituloModo(modo)}</DialogTitle>
            <DialogDescription>
              {venta
                ? "El NCF se consume de forma atómica desde la secuencia activa de la empresa."
                : "Registra el comprobante del proveedor con su NCF y retenciones."}
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

          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <FormGrid>
              {nota ? (
                <FormField
                  htmlFor="documento-acreditado"
                  label="Documento acreditado"
                  required
                  className="sm:col-span-2 lg:col-span-3"
                >
                  <SelectCampo
                    id="documento-acreditado"
                    opciones={opcionesAcreditables}
                    valor={form.documentoAcreditadoId}
                    onCambio={elegirAcreditado}
                    etiquetaVacia="Selecciona la factura"
                    buscable
                    requerido
                    aria-label="Documento acreditado"
                  />
                </FormField>
              ) : null}

              <FormField htmlFor="documento-tercero" label="Tercero" required>
                <SelectCampo
                  id="documento-tercero"
                  opciones={opcionesTerceros}
                  valor={form.terceroId}
                  onCambio={(valor) => actualizar("terceroId", valor)}
                  etiquetaVacia={
                    venta ? "Selecciona el cliente" : "Selecciona el proveedor"
                  }
                  buscable
                  requerido
                  aria-label="Tercero del documento"
                />
              </FormField>

              <FormField
                htmlFor="documento-fecha"
                label="Fecha de emisión"
                required
              >
                <DatePicker
                  id="documento-fecha"
                  value={form.fechaEmision}
                  onChange={(valor) => actualizar("fechaEmision", valor)}
                />
              </FormField>

              <FormField htmlFor="documento-vencimiento" label="Vencimiento">
                <DatePicker
                  id="documento-vencimiento"
                  value={form.fechaVencimiento}
                  onChange={(valor) => actualizar("fechaVencimiento", valor)}
                  permitirLimpiar
                />
              </FormField>

              <FormField
                htmlFor="documento-concepto"
                label="Concepto"
                required
                className="sm:col-span-2 lg:col-span-3"
              >
                <Input
                  id="documento-concepto"
                  value={form.concepto}
                  onChange={(evento) =>
                    actualizar("concepto", evento.target.value)
                  }
                  placeholder="Descripción del documento"
                />
              </FormField>

              <FormField htmlFor="documento-subtotal" label="Subtotal" required>
                <Input
                  id="documento-subtotal"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.subtotal}
                  onChange={(evento) => cambiarSubtotal(evento.target.value)}
                  placeholder="0.00"
                  className="tabular-nums"
                />
              </FormField>

              <FormField
                htmlFor="documento-impuesto"
                label={`ITBIS (${(tasaItbisBps / 100).toFixed(0)}%)`}
              >
                <Input
                  id="documento-impuesto"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.impuesto}
                  onChange={(evento) =>
                    actualizar("impuesto", evento.target.value)
                  }
                  placeholder="0.00"
                  className="tabular-nums"
                />
              </FormField>

              {venta ? null : (
                <>
                  <FormField htmlFor="documento-ret-isr" label="Retención ISR">
                    <Input
                      id="documento-ret-isr"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={form.retencionIsr}
                      onChange={(evento) =>
                        actualizar("retencionIsr", evento.target.value)
                      }
                      placeholder="0.00"
                      className="tabular-nums"
                    />
                  </FormField>

                  <FormField
                    htmlFor="documento-ret-itbis"
                    label="Retención ITBIS"
                  >
                    <Input
                      id="documento-ret-itbis"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={form.retencionItbis}
                      onChange={(evento) =>
                        actualizar("retencionItbis", evento.target.value)
                      }
                      placeholder="0.00"
                      className="tabular-nums"
                    />
                  </FormField>
                </>
              )}

              <FormField
                htmlFor="documento-cuenta"
                label={venta ? "Cuenta de ingreso" : "Cuenta de gasto"}
                required
              >
                <SelectCampo
                  id="documento-cuenta"
                  opciones={opcionesCuentaPrincipal}
                  valor={form.cuentaId}
                  onCambio={(valor) => actualizar("cuentaId", valor)}
                  etiquetaVacia="Selecciona la cuenta"
                  buscable
                  requerido
                  aria-label="Cuenta contable del documento"
                />
              </FormField>

              <FormField
                htmlFor="documento-cuenta-control"
                label={venta ? "Cuenta por cobrar" : "Cuenta por pagar"}
                required
              >
                <SelectCampo
                  id="documento-cuenta-control"
                  opciones={opcionesCuentaControl}
                  valor={form.cuentaControlId}
                  onCambio={(valor) => actualizar("cuentaControlId", valor)}
                  etiquetaVacia="Selecciona la cuenta de control"
                  buscable
                  requerido
                  aria-label="Cuenta de control"
                />
              </FormField>

              <FormField
                htmlFor="documento-cuenta-impuesto"
                label="Cuenta de ITBIS"
              >
                <SelectCampo
                  id="documento-cuenta-impuesto"
                  opciones={opcionesCuentaImpuesto}
                  valor={form.cuentaImpuestoId}
                  onCambio={(valor) => actualizar("cuentaImpuestoId", valor)}
                  etiquetaVacia="Sin cuenta de impuesto"
                  buscable
                  aria-label="Cuenta de ITBIS"
                />
              </FormField>

              <FormField
                htmlFor="documento-cuenta-retencion"
                label="Cuenta de retenciones"
              >
                <SelectCampo
                  id="documento-cuenta-retencion"
                  opciones={opcionesCuentaRetencion}
                  valor={form.cuentaRetencionId}
                  onCambio={(valor) => actualizar("cuentaRetencionId", valor)}
                  etiquetaVacia="Sin cuenta de retención"
                  buscable
                  aria-label="Cuenta de retenciones"
                />
              </FormField>

              {venta ? (
                <>
                  <FormField
                    htmlFor="documento-secuencia"
                    label="Comprobante NCF"
                  >
                    <SelectCampo
                      id="documento-secuencia"
                      opciones={opcionesSecuencias}
                      valor={ncfManual ? "__manual" : form.tipoNcf}
                      onCambio={(valor) => {
                        if (valor === "__manual") {
                          setNcfManual(true);
                          return;
                        }
                        setNcfManual(false);
                        actualizar("tipoNcf", valor);
                      }}
                      etiquetaVacia="Sin comprobante"
                      aria-label="Secuencia NCF"
                    />
                    <button
                      type="button"
                      className="mt-1 self-start text-xs font-medium text-primary hover:underline"
                      onClick={() => setNcfManual((anterior) => !anterior)}
                    >
                      {ncfManual
                        ? "Consumir secuencia automática"
                        : "Escribir NCF manual"}
                    </button>
                  </FormField>

                  {ncfManual ? (
                    <>
                      <FormField
                        htmlFor="documento-tipo-ncf"
                        label="Tipo de NCF"
                      >
                        <SelectCampo
                          id="documento-tipo-ncf"
                          opciones={opcionesTipoNcf}
                          valor={form.tipoNcf}
                          onCambio={(valor) => actualizar("tipoNcf", valor)}
                          etiquetaVacia="Selecciona el tipo"
                          aria-label="Tipo de NCF"
                        />
                      </FormField>

                      <FormField htmlFor="documento-ncf" label="NCF manual">
                        <Input
                          id="documento-ncf"
                          value={form.ncf}
                          onChange={(evento) =>
                            actualizar("ncf", evento.target.value)
                          }
                          placeholder="B0100000001"
                          className="font-mono text-xs uppercase"
                        />
                      </FormField>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  <FormField
                    htmlFor="documento-tipo-ncf"
                    label="Tipo de comprobante"
                  >
                    <SelectCampo
                      id="documento-tipo-ncf"
                      opciones={opcionesTipoNcf}
                      valor={form.tipoNcf}
                      onCambio={(valor) => actualizar("tipoNcf", valor)}
                      etiquetaVacia="Sin comprobante"
                      aria-label="Tipo de comprobante"
                    />
                  </FormField>

                  <FormField
                    htmlFor="documento-ncf"
                    label="NCF del proveedor"
                    required
                  >
                    <Input
                      id="documento-ncf"
                      value={form.ncf}
                      onChange={(evento) =>
                        actualizar("ncf", evento.target.value)
                      }
                      placeholder="B0100000001"
                      className="font-mono text-xs uppercase"
                    />
                  </FormField>
                </>
              )}
            </FormGrid>

            <div className="mt-4 flex flex-col gap-1 rounded-[10px] border border-border bg-muted/50 px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Subtotal + ITBIS</span>
                <span className="tabular-nums">
                  {formatearMoneda(subtotal + impuesto)}
                </span>
              </div>
              {retenciones > 0 ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Retenciones</span>
                  <span className="tabular-nums">
                    -{formatearMoneda(retenciones)}
                  </span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-2 border-t border-border pt-1.5 font-medium text-foreground">
                <span>Total del documento</span>
                <span className="tabular-nums">{formatearMoneda(total)}</span>
              </div>
              {acreditado ? (
                <p className="text-xs text-muted-foreground">
                  Saldo disponible del documento acreditado:{" "}
                  <span className="tabular-nums">
                    {formatearMoneda(acreditado.saldo)}
                  </span>
                </p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={guardando}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? (
                <>
                  <IconLoader2 className="size-4 animate-spin" />
                  Emitiendo…
                </>
              ) : (
                <>
                  {venta ? (
                    <IconFileInvoice className="size-4" />
                  ) : (
                    <IconReceipt2 className="size-4" />
                  )}
                  {nota
                    ? "Emitir nota de crédito"
                    : venta
                      ? "Emitir factura"
                      : "Registrar compra"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
