"use client";

import {
  IconFileInvoice,
  IconLoader2,
  IconPlus,
  IconReceipt2,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { registrarDocumentoAction } from "@/app/(app)/documentos/actions";
import { guardarTerceroAction } from "@/app/(app)/gastos/terceros-actions";
import { DatePicker } from "@/components/date-picker";
import { FormField, FormGrid } from "@/components/formularios/form-card";
import {
  DialogoConfirmarDescarte,
  formularioTieneCambios,
} from "@/components/operaciones/dialogos-cartera";
import { SelectCampo } from "@/components/select-campo";
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
import { Input } from "@/components/ui/input";
import {
  aNumero,
  formatearMoneda,
  hoySantoDomingo,
  normalizarRnc,
} from "@/lib/formato";
import {
  type CuentasInicialesDocumento,
  cuentasParaCampoDocumento,
  rellenarCuentasPorDefectoVacias,
  resolverCuentaRetencionDocumento,
  resolverCuentasInicialesDocumento,
} from "@/lib/operaciones/cuentas-opciones";
import { guardarDocumentoBorradorAction } from "@/lib/operaciones/documentos-borrador-actions";
import type {
  ArticuloDocumento,
  CuentaOpcion,
  DocumentoAcreditable,
  DocumentoListado,
  MetodoPagoOpcion,
  SecuenciaNcfListado,
  TerceroListado,
} from "@/lib/operaciones/tipos";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

export type ModoDocumento =
  | "compra"
  | "venta"
  | "nota_credito_compra"
  | "nota_credito_venta";

interface FormDocumento {
  numero: string;
  terceroId: string;
  fechaEmision: string;
  fechaVencimiento: string;
  concepto: string;
  subtotal: string;
  impuesto: string;
  retenciones: string;
  retencionIsr: string;
  retencionItbis: string;
  tipoRetencionIsr: string;
  fechaPagoRetenciones: string;
  otrosImpuestos: string;
  tipoGasto: string;
  cuentaId: string;
  cuentaControlId: string;
  cuentaImpuestoId: string;
  cuentaRetencionId: string;
  tipoNcf: string;
  ncf: string;
  documentoAcreditadoId: string;
  metodoPagoId: string;
  proforma: boolean;
  detallar: boolean;
}

interface RenglonForm {
  id: string;
  modo: "account" | "item";
  cuentaId: string;
  articuloId: string;
  cantidad: string;
  precio: string;
  monto: string;
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
  cuentaItbisAdelantadoId?: string | null;
  cuentaItbisPorPagarId?: string | null;
  cuentaRetencionIsrId?: string | null;
  cuentaRetencionItbisId?: string | null;
  cuentaCxcDefaultId?: string | null;
  cuentaCxpDefaultId?: string | null;
  metodosPago?: readonly MetodoPagoOpcion[];
  articulos?: readonly ArticuloDocumento[];
  rncEmpresa?: string;
  documentoInicial?: DocumentoListado | null;
}

const COMPROBANTES_VENTA = [
  { value: "B01", label: "B01 · Crédito fiscal" },
  { value: "B02", label: "B02 · Consumo" },
  { value: "B14", label: "B14 · Regímenes especiales" },
  { value: "B15", label: "B15 · Gubernamental" },
] as const;

const COMPROBANTES_PROPIOS = [
  { value: "B13", label: "B13 · Gastos menores" },
  { value: "B11", label: "B11 · Compras" },
] as const;

const TIPOS_GASTO_DGII = [
  ["01", "01 · Gastos de personal"],
  ["02", "02 · Gastos por trabajos, suministros y servicios"],
  ["03", "03 · Arrendamientos"],
  ["04", "04 · Gastos de activos fijo"],
  ["05", "05 · Gastos de representación"],
  ["06", "06 · Otras deducciones admitidas"],
  ["07", "07 · Gastos financieros"],
  ["08", "08 · Gastos extraordinarios"],
  ["09", "09 · Compras y gastos que formarán parte del costo de venta"],
  ["10", "10 · Adquisiciones de activos"],
  ["11", "11 · Gastos de seguros"],
] as const;

const TIPOS_RETENCION_ISR = [
  ["1", "1 · Alquileres"],
  ["2", "2 · Honorarios por servicios"],
  ["3", "3 · Otras rentas"],
  ["4", "4 · Otras rentas (presuntas)"],
  ["5", "5 · Intereses pagados a personas jurídicas residentes"],
  ["6", "6 · Intereses pagados a personas físicas residentes"],
  ["7", "7 · Proveedores del Estado"],
  ["8", "8 · Juegos telefónicos"],
  ["9", "9 · Retenciones subsector ganadería de carne bovina"],
] as const;

function esVenta(modo: ModoDocumento): boolean {
  return modo === "venta" || modo === "nota_credito_venta";
}

function esNota(modo: ModoDocumento): boolean {
  return modo === "nota_credito_compra" || modo === "nota_credito_venta";
}

function tipoDocumento(modo: ModoDocumento) {
  if (modo === "compra") return "purchase_invoice" as const;
  if (modo === "venta") return "sales_invoice" as const;
  if (modo === "nota_credito_compra") return "purchase_credit" as const;
  return "sales_credit" as const;
}

function tituloModo(modo: ModoDocumento, editando: boolean): string {
  const prefijo = editando ? "Editar" : "Nueva";
  if (modo === "compra") return editando ? "Editar compra" : "Nueva compra";
  if (modo === "venta") return editando ? "Editar factura" : "Nueva factura";
  if (modo === "nota_credito_compra") {
    return `${prefijo} nota de crédito de compra`;
  }
  return `${prefijo} nota de crédito de venta`;
}

function opcionesDeCuentas(cuentas: readonly CuentaOpcion[]) {
  return cuentas.map((cuenta) => ({
    value: cuenta.id,
    label: `${cuenta.codigo} · ${cuenta.nombre}`,
  }));
}

function textoDetalle(
  detalles: Record<string, unknown>,
  clave: string,
): string {
  const valor = detalles[clave];
  return typeof valor === "string" ? valor : "";
}

function numeroDetalle(
  detalles: Record<string, unknown>,
  clave: string,
): string {
  const valor = detalles[clave];
  return typeof valor === "number" && Number.isFinite(valor) && valor > 0
    ? valor.toFixed(2)
    : "";
}

function nuevoRenglon(): RenglonForm {
  return {
    id: crypto.randomUUID(),
    modo: "account",
    cuentaId: "",
    articuloId: "",
    cantidad: "",
    precio: "",
    monto: "",
  };
}

function renglonesDesdeDocumento(
  documento: DocumentoListado,
  venta: boolean,
): RenglonForm[] {
  const lineas = documento.detallesFiscales.lines;
  if (!Array.isArray(lineas)) return [];

  const salida: RenglonForm[] = [];
  for (const linea of lineas) {
    if (typeof linea !== "object" || linea === null) continue;
    const fila = linea as Record<string, unknown>;
    const articuloId = typeof fila.item_id === "string" ? fila.item_id : "";
    const cantidad = typeof fila.quantity === "number" ? fila.quantity : 0;
    const precio =
      typeof fila[venta ? "unit_price" : "unit_cost"] === "number"
        ? (fila[venta ? "unit_price" : "unit_cost"] as number)
        : 0;
    salida.push({
      id: crypto.randomUUID(),
      modo: articuloId === "" ? "account" : "item",
      cuentaId: typeof fila.account_id === "string" ? fila.account_id : "",
      articuloId,
      cantidad: cantidad > 0 ? String(cantidad) : "",
      precio: precio > 0 ? precio.toFixed(2) : "",
      monto:
        typeof fila.amount === "number" && fila.amount > 0
          ? fila.amount.toFixed(2)
          : "",
    });
  }
  return salida;
}

function formDesdeDocumento(
  documento: DocumentoListado,
  venta: boolean,
): FormDocumento {
  const detalles = documento.detallesFiscales;
  return {
    numero: documento.numero,
    terceroId: documento.terceroId,
    fechaEmision: documento.fechaEmision,
    fechaVencimiento: documento.fechaVencimiento ?? documento.fechaEmision,
    concepto: documento.concepto,
    subtotal: documento.subtotal.toFixed(2),
    impuesto: documento.impuesto.toFixed(2),
    retenciones: documento.retenciones.toFixed(2),
    retencionIsr:
      numeroDetalle(detalles, "income_tax_withheld") ||
      numeroDetalle(detalles, "retencion_isr") ||
      (!venta && documento.retenciones > 0
        ? documento.retenciones.toFixed(2)
        : ""),
    retencionItbis:
      numeroDetalle(detalles, "itbis_withheld") ||
      numeroDetalle(detalles, "retencion_itbis"),
    tipoRetencionIsr: textoDetalle(detalles, "isr_retention_type"),
    fechaPagoRetenciones: textoDetalle(detalles, "payment_date"),
    otrosImpuestos: documento.otrosImpuestos.toFixed(2),
    tipoGasto: textoDetalle(detalles, "goods_services_type"),
    cuentaId: documento.cuentaId,
    cuentaControlId: documento.cuentaControlId,
    cuentaImpuestoId: documento.cuentaImpuestoId ?? "",
    cuentaRetencionId: documento.cuentaRetencionId ?? "",
    tipoNcf: documento.tipoNcf,
    ncf: documento.ncf,
    documentoAcreditadoId: documento.documentoAcreditadoId ?? "",
    metodoPagoId: textoDetalle(detalles, "payment_method_id"),
    proforma: detalles.proforma === true,
    detallar: Array.isArray(detalles.lines) && detalles.lines.length > 0,
  };
}

function formInicial(
  modo: ModoDocumento,
  cuentasIniciales: CuentasInicialesDocumento,
): FormDocumento {
  const hoy = hoySantoDomingo();
  return {
    numero: "",
    terceroId: "",
    fechaEmision: hoy,
    fechaVencimiento: hoy,
    concepto: "",
    subtotal: "",
    impuesto: "",
    retenciones: "",
    retencionIsr: "",
    retencionItbis: "",
    tipoRetencionIsr: "",
    fechaPagoRetenciones: "",
    otrosImpuestos: "",
    tipoGasto: "",
    cuentaId: "",
    cuentaControlId: cuentasIniciales.cuentaControlId,
    cuentaImpuestoId: cuentasIniciales.cuentaImpuestoId,
    cuentaRetencionId: cuentasIniciales.cuentaRetencionId,
    tipoNcf: modo === "venta" ? "B01" : "",
    ncf: "",
    documentoAcreditadoId: "",
    metodoPagoId: "",
    proforma: false,
    detallar: false,
  };
}

function sanitizarArchivo(nombre: string): string {
  return nombre.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}

/**
 * Modal original de documentos: crea borradores (compra, venta, proformas y
 * notas), permite editarlos y conserva renglones/inventario en SQL. Nunca
 * contabiliza al guardar: la contabilización es una acción posterior explícita.
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
  cuentaItbisAdelantadoId,
  cuentaItbisPorPagarId,
  cuentaRetencionIsrId,
  cuentaRetencionItbisId,
  cuentaCxcDefaultId,
  cuentaCxpDefaultId,
  metodosPago = [],
  articulos = [],
  rncEmpresa = "",
  documentoInicial = null,
}: DocumentoFormDialogProps) {
  const venta = esVenta(modo);
  const nota = esNota(modo);
  const facturaVenta = modo === "venta";
  const compraFactura = modo === "compra";
  const operacionDocumento = venta ? "venta" : "compra";
  const editando = documentoInicial !== null;

  const cuentasFiscales = useMemo(
    () => ({
      cuentaItbisAdelantadoId,
      cuentaItbisPorPagarId,
      cuentaRetencionIsrId,
      cuentaRetencionItbisId,
      cuentaCxcDefaultId,
      cuentaCxpDefaultId,
    }),
    [
      cuentaItbisAdelantadoId,
      cuentaItbisPorPagarId,
      cuentaRetencionIsrId,
      cuentaRetencionItbisId,
      cuentaCxcDefaultId,
      cuentaCxpDefaultId,
    ],
  );

  const cuentasIniciales = useMemo(
    () =>
      resolverCuentasInicialesDocumento(operacionDocumento, cuentasFiscales),
    [operacionDocumento, cuentasFiscales],
  );

  const [tercerosLocales, setTercerosLocales] =
    useState<readonly TerceroListado[]>(terceros);
  const [form, setForm] = useState<FormDocumento>(
    documentoInicial
      ? formDesdeDocumento(documentoInicial, venta)
      : formInicial(modo, cuentasIniciales),
  );
  const [formReferencia, setFormReferencia] = useState<FormDocumento>(form);
  const [renglones, setRenglones] = useState<RenglonForm[]>(
    documentoInicial ? renglonesDesdeDocumento(documentoInicial, venta) : [],
  );
  const [renglonesReferencia, setRenglonesReferencia] =
    useState<RenglonForm[]>(renglones);
  const [rncBusqueda, setRncBusqueda] = useState("");
  const [estadoRnc, setEstadoRnc] = useState("");
  const [buscandoRnc, setBuscandoRnc] = useState(false);
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [cuentaRetencionManual, setCuentaRetencionManual] = useState(false);
  const [impuestoManual, setImpuestoManual] = useState(editando);
  const [guardando, setGuardando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  const enviandoRef = useRef(false);
  const aperturaRef = useRef({
    abierto: false,
    modo,
    documentoId: documentoInicial?.id ?? "",
  });

  useEffect(() => {
    setTercerosLocales(terceros);
  }, [terceros]);

  useEffect(() => {
    if (!abierto) {
      aperturaRef.current = { abierto: false, modo, documentoId: "" };
      setConfirmandoDescarte(false);
      return;
    }

    const documentoId = documentoInicial?.id ?? "";
    const reiniciar =
      !aperturaRef.current.abierto ||
      aperturaRef.current.modo !== modo ||
      aperturaRef.current.documentoId !== documentoId;

    if (reiniciar) {
      const inicial = documentoInicial
        ? formDesdeDocumento(documentoInicial, venta)
        : formInicial(modo, cuentasIniciales);
      const lineas = documentoInicial
        ? renglonesDesdeDocumento(documentoInicial, venta)
        : [];
      setForm(inicial);
      setFormReferencia(inicial);
      setRenglones(lineas);
      setRenglonesReferencia(lineas);
      setRncBusqueda("");
      setEstadoRnc("");
      setComprobante(null);
      setCuentaRetencionManual(false);
      setImpuestoManual(documentoInicial !== null);
      setErrorGeneral(null);
      setGuardando(enviandoRef.current);
    } else if (!documentoInicial) {
      setForm((anterior) => ({
        ...rellenarCuentasPorDefectoVacias(
          anterior,
          operacionDocumento,
          cuentasFiscales,
        ),
        tipoNcf: anterior.tipoNcf || (facturaVenta ? "B01" : anterior.tipoNcf),
      }));
    }

    aperturaRef.current = { abierto: true, modo, documentoId };
  }, [
    abierto,
    modo,
    documentoInicial,
    venta,
    cuentasIniciales,
    cuentasFiscales,
    operacionDocumento,
    facturaVenta,
  ]);

  const terceroSeleccionado =
    tercerosLocales.find((tercero) => tercero.id === form.terceroId) ?? null;
  const rncPropio =
    compraFactura &&
    normalizarRnc(rncEmpresa) !== "" &&
    normalizarRnc(terceroSeleccionado?.rnc ?? "") === normalizarRnc(rncEmpresa);

  useEffect(() => {
    if (!rncPropio || form.tipoNcf !== "B13") return;
    if (aNumero(form.impuesto) > 0 || aNumero(form.retencionItbis) > 0) {
      setForm((anterior) => ({
        ...anterior,
        impuesto: "",
        retencionItbis: "",
      }));
    }
  }, [rncPropio, form.tipoNcf, form.impuesto, form.retencionItbis]);

  useEffect(() => {
    if (!abierto || cuentaRetencionManual) return;

    const retencionIsr = compraFactura
      ? aNumero(form.retencionIsr)
      : aNumero(form.retenciones);
    const retencionItbis = compraFactura ? aNumero(form.retencionItbis) : 0;
    if (retencionIsr <= 0 && retencionItbis <= 0) return;

    const cuentaSugerida = resolverCuentaRetencionDocumento(
      cuentasFiscales,
      retencionIsr,
      retencionItbis,
    );
    if (cuentaSugerida === "") return;

    setForm((anterior) => {
      if (anterior.cuentaRetencionId === cuentaSugerida) return anterior;
      return { ...anterior, cuentaRetencionId: cuentaSugerida };
    });
  }, [
    abierto,
    cuentaRetencionManual,
    compraFactura,
    cuentasFiscales,
    form.retenciones,
    form.retencionIsr,
    form.retencionItbis,
  ]);

  const opcionesTerceros = useMemo(
    () =>
      tercerosLocales
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
    [tercerosLocales, venta],
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

  const opcionesComprobanteVenta = useMemo(() => {
    const opciones: { value: string; label: string }[] = COMPROBANTES_VENTA.map(
      (opcion) => ({ ...opcion }),
    );
    for (const secuencia of secuencias) {
      if (!secuencia.activo || secuencia.serie !== "E") continue;
      if (secuencia.numeroActual >= secuencia.numeroFinal) continue;
      if (opciones.some((opcion) => opcion.value === secuencia.tipoComprobante))
        continue;
      opciones.push({
        value: secuencia.tipoComprobante,
        label: `${secuencia.tipoComprobante} · Comprobante electrónico`,
      });
    }
    return opciones;
  }, [secuencias]);

  const opcionesMetodosPago = useMemo(
    () =>
      metodosPago
        .filter((metodo) => metodo.activo)
        .map((metodo) => {
          const cuenta = cuentas.find((fila) => fila.id === metodo.cuentaId);
          return {
            value: metodo.id,
            label: `${metodo.nombre}${cuenta ? ` · ${cuenta.codigo} ${cuenta.nombre}` : ""}${metodo.dejaCxpProveedor ? " · queda pendiente" : " · pagada"}`,
          };
        }),
    [metodosPago, cuentas],
  );

  const opcionesArticulos = useMemo(
    () =>
      articulos.map((articulo) => ({
        value: articulo.id,
        label: `${articulo.sku} · ${articulo.nombre}`,
      })),
    [articulos],
  );

  const opcionesAcreditables = useMemo(
    () =>
      documentosAcreditables.map((documento) => ({
        value: documento.id,
        label: `${documento.numero} · ${documento.tercero} · saldo ${formatearMoneda(documento.saldo)}`,
      })),
    [documentosAcreditables],
  );

  const subtotalRenglones = useMemo(
    () => renglones.reduce((suma, linea) => suma + aNumero(linea.monto), 0),
    [renglones],
  );
  const subtotalEfectivo = form.detallar
    ? subtotalRenglones
    : aNumero(form.subtotal);
  const impuesto = aNumero(form.impuesto);
  const otrosImpuestos = compraFactura ? aNumero(form.otrosImpuestos) : 0;
  const retencionesTotales = compraFactura
    ? aNumero(form.retenciones)
    : aNumero(form.retenciones);
  const total = Math.max(
    subtotalEfectivo + impuesto + otrosImpuestos - retencionesTotales,
    0,
  );
  const acreditado =
    documentosAcreditables.find(
      (documento) => documento.id === form.documentoAcreditadoId,
    ) ?? null;

  const renglonesCambiaron =
    JSON.stringify(renglones.map(({ id, ...linea }) => linea)) !==
    JSON.stringify(renglonesReferencia.map(({ id, ...linea }) => linea));
  const hayCambios =
    formularioTieneCambios(form, formReferencia) ||
    renglonesCambiaron ||
    comprobante !== null;

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

  function actualizar<C extends keyof FormDocumento>(
    campo: C,
    valor: FormDocumento[C],
  ) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  }

  function cambiarSubtotal(valor: string) {
    setForm((anterior) => {
      const nuevoSubtotal = aNumero(valor);
      const itbisSugerido =
        nuevoSubtotal > 0
          ? ((nuevoSubtotal * tasaItbisBps) / 10000).toFixed(2)
          : "";
      return {
        ...anterior,
        subtotal: valor,
        impuesto: impuestoManual ? anterior.impuesto : itbisSugerido,
      };
    });
  }

  function recalcularLinea(linea: RenglonForm): RenglonForm {
    if (linea.modo !== "item") return linea;
    const cantidad = aNumero(linea.cantidad);
    const precio = aNumero(linea.precio);
    const monto = Math.round(cantidad * precio * 100) / 100;
    return { ...linea, monto: monto > 0 ? monto.toFixed(2) : "" };
  }

  function actualizarRenglon(id: string, cambios: Partial<RenglonForm>) {
    setRenglones((anterior) =>
      anterior.map((linea) =>
        linea.id === id ? recalcularLinea({ ...linea, ...cambios }) : linea,
      ),
    );
  }

  function agregarRenglon() {
    setRenglones((anterior) => [...anterior, nuevoRenglon()]);
  }

  function quitarRenglon(id: string) {
    setRenglones((anterior) => anterior.filter((linea) => linea.id !== id));
  }

  async function buscarProveedor() {
    const rnc = normalizarRnc(rncBusqueda);
    if (rnc.length !== 9 && rnc.length !== 11) {
      setEstadoRnc("Escribe un RNC de 9 dígitos o una cédula de 11.");
      return;
    }

    setBuscandoRnc(true);
    setEstadoRnc("Consultando proveedor…");
    try {
      const existente = tercerosLocales.find(
        (tercero) => normalizarRnc(tercero.rnc) === rnc,
      );
      if (existente) {
        actualizar("terceroId", existente.id);
        setEstadoRnc(`✓ Proveedor: ${existente.nombre}`);
        return;
      }

      const respuesta = await fetch(
        `/api/dgii/rnc?numero=${encodeURIComponent(rnc)}`,
        { cache: "no-store" },
      );
      const cuerpo = (await respuesta.json()) as {
        ok?: boolean;
        mensaje?: string;
        datos?: { nombre: string; nombreComercial: string | null };
      };
      if (!cuerpo.ok || !cuerpo.datos) {
        setEstadoRnc(
          cuerpo.mensaje ??
            "RNC no encontrado; selecciona o registra el proveedor.",
        );
        return;
      }

      const nombre = cuerpo.datos.nombreComercial || cuerpo.datos.nombre;
      const resultado = await guardarTerceroAction({
        empresaId,
        tipo: "supplier",
        nombre,
        rnc,
        correo: "",
        telefono: "",
        direccion: "",
        cuentaPorPagarId: null,
        cuentaPorCobrarId: null,
        activo: true,
      });

      if (!resultado.ok) {
        setEstadoRnc(
          `DGII: ${nombre} — no se pudo registrar (${resultado.error})`,
        );
        return;
      }
      if (!resultado.datos) {
        setEstadoRnc(`DGII: ${nombre} — no se pudo registrar.`);
        return;
      }

      const nuevo: TerceroListado = {
        id: resultado.datos.id,
        tipo: "supplier",
        nombre,
        rnc,
        correo: "",
        telefono: "",
        direccion: "",
        activo: true,
        cuentaPorPagarId: null,
        cuentaPorCobrarId: null,
      };
      setTercerosLocales((anterior) => [...anterior, nuevo]);
      actualizar("terceroId", nuevo.id);
      setEstadoRnc(`✓ Proveedor creado desde DGII: ${nombre}`);
    } catch {
      setEstadoRnc("No pudimos consultar la DGII. Intenta de nuevo.");
    } finally {
      setBuscandoRnc(false);
    }
  }

  function validarArchivo(): string | null {
    if (!comprobante) return null;
    const tipos = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (comprobante.size > 900000 || !tipos.includes(comprobante.type)) {
      return "Adjunta un comprobante PDF o imagen de hasta 900 KB.";
    }
    return null;
  }

  async function subirComprobante(documentoId: string): Promise<string | null> {
    if (!comprobante) return null;
    const nombreSeguro = sanitizarArchivo(comprobante.name);
    const ruta = `${empresaId}/compras/${documentoId}/${crypto.randomUUID()}-${nombreSeguro}`;
    const supabase = createBrowserClient();
    const { error: errorArchivo } = await supabase.storage
      .from("documentos")
      .upload(ruta, comprobante, {
        cacheControl: "3600",
        contentType: comprobante.type,
        upsert: false,
      });

    if (errorArchivo) return errorArchivo.message;

    const registro = await registrarDocumentoAction({
      empresaId,
      entidad: "compra",
      entidadId: documentoId,
      nombreArchivo: comprobante.name,
      rutaStorage: ruta,
      mimeType: comprobante.type,
      tamanoBytes: comprobante.size,
    });

    if (!registro.ok) {
      await supabase.storage.from("documentos").remove([ruta]);
      return registro.error;
    }
    return null;
  }

  function lineasValidas() {
    const salida: {
      cuentaId: string | null;
      monto: number;
      descripcion: string;
      articuloId: string | null;
      cantidad: number | null;
      precioUnitario: number | null;
      costoUnitario: number | null;
    }[] = [];

    for (const linea of renglones) {
      if (linea.modo === "item") {
        const cantidad = aNumero(linea.cantidad);
        const precio = aNumero(linea.precio);
        if (linea.articuloId === "" || cantidad <= 0 || precio < 0) continue;
        salida.push({
          cuentaId: null,
          monto: aNumero(linea.monto),
          descripcion: "",
          articuloId: linea.articuloId,
          cantidad,
          precioUnitario: venta ? precio : null,
          costoUnitario: venta ? null : precio,
        });
      } else {
        const monto = aNumero(linea.monto);
        if (linea.cuentaId === "" || monto <= 0) continue;
        salida.push({
          cuentaId: linea.cuentaId,
          monto,
          descripcion: "",
          articuloId: null,
          cantidad: null,
          precioUnitario: null,
          costoUnitario: null,
        });
      }
    }
    return salida;
  }

  function validar(): string | null {
    if (form.numero.trim() === "") return "El número interno es obligatorio.";
    if (form.terceroId === "") {
      return venta ? "Selecciona el cliente." : "Selecciona el proveedor.";
    }
    if (form.concepto.trim() === "")
      return "El concepto del documento es obligatorio.";
    if (form.fechaVencimiento < form.fechaEmision) {
      return "El vencimiento no puede ser anterior a la fecha de emisión.";
    }
    if (nota && form.documentoAcreditadoId === "") {
      return "Selecciona la factura original que acredita esta nota.";
    }
    if (form.detallar) {
      if (renglones.length === 0 || lineasValidas().length === 0) {
        return "Agrega al menos un renglón válido.";
      }
    } else {
      if (subtotalEfectivo <= 0) return "El subtotal debe ser mayor que cero.";
      if (form.cuentaId === "") {
        return venta
          ? "Selecciona la cuenta de ingreso."
          : "Selecciona la cuenta de gasto o costo.";
      }
    }
    if (compraFactura && form.metodoPagoId === "") {
      return "Selecciona la forma de pago.";
    }
    if (!compraFactura && form.cuentaControlId === "") {
      return venta
        ? "Selecciona la cuenta por cobrar."
        : "Selecciona la cuenta por pagar.";
    }
    if (compraFactura && !rncPropio && form.ncf.trim() === "") {
      return "El NCF del proveedor es obligatorio.";
    }
    if (rncPropio && form.tipoNcf === "") {
      return "Selecciona el tipo de comprobante propio.";
    }
    if (rncPropio && form.tipoNcf === "B13" && impuesto > 0) {
      return "El comprobante B13 no permite transparentar ITBIS.";
    }
    if (nota && acreditado && total > acreditado.saldo) {
      return `La nota excede el saldo disponible (${formatearMoneda(acreditado.saldo)}).`;
    }

    if (compraFactura) {
      const isr = aNumero(form.retencionIsr);
      const itbisRetenido = aNumero(form.retencionItbis);
      if (isr + itbisRetenido > aNumero(form.retenciones)) {
        return "Retenciones totales debe incluir las retenciones de ITBIS e ISR.";
      }
      if (
        isr > 0 &&
        (form.tipoRetencionIsr === "" || form.fechaPagoRetenciones === "")
      ) {
        return "Indica el tipo DGII y la fecha de pago de la retención ISR.";
      }
      if (itbisRetenido > 0 && form.fechaPagoRetenciones === "") {
        return "Indica la fecha de pago del ITBIS retenido.";
      }
      if (isr <= 0 && form.tipoRetencionIsr !== "") {
        return "Indica el importe de ISR para el tipo de retención seleccionado.";
      }
      const errorArchivo = validarArchivo();
      if (errorArchivo) return errorArchivo;
    }

    if (total <= 0) return "El total bruto debe ser mayor que cero.";
    return null;
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviandoRef.current || guardando) return;

    const error = validar();
    if (error) {
      setErrorGeneral(error);
      return;
    }

    enviandoRef.current = true;
    setGuardando(true);
    setErrorGeneral(null);

    try {
      const lineas = form.detallar ? lineasValidas() : [];
      const resultado = await guardarDocumentoBorradorAction({
        empresaId,
        documentoId: documentoInicial?.id ?? null,
        tipo: tipoDocumento(modo),
        numero: form.numero.trim(),
        terceroId: form.terceroId,
        fechaEmision: form.fechaEmision,
        fechaVencimiento: form.fechaVencimiento,
        concepto: form.concepto.trim(),
        cuentaId: form.detallar ? null : form.cuentaId || null,
        cuentaControlId: compraFactura ? null : form.cuentaControlId || null,
        cuentaImpuestoId: form.cuentaImpuestoId || null,
        cuentaRetencionId: form.cuentaRetencionId || null,
        subtotal: subtotalEfectivo,
        impuesto,
        retenciones: compraFactura
          ? aNumero(form.retenciones)
          : aNumero(form.retenciones),
        retencionIsr: compraFactura ? aNumero(form.retencionIsr) : 0,
        retencionItbis: compraFactura ? aNumero(form.retencionItbis) : 0,
        otrosImpuestos,
        tipoNcf: facturaVenta && form.proforma ? "" : form.tipoNcf,
        ncf: facturaVenta && form.proforma ? "" : form.ncf.trim().toUpperCase(),
        documentoAcreditadoId: form.documentoAcreditadoId || null,
        proforma: facturaVenta ? form.proforma : false,
        tipoGasto:
          compraFactura || modo === "nota_credito_compra" ? form.tipoGasto : "",
        tipoRetencionIsr: compraFactura ? form.tipoRetencionIsr : "",
        fechaPagoRetenciones: compraFactura ? form.fechaPagoRetenciones : "",
        metodoPagoId: compraFactura ? form.metodoPagoId || null : null,
        lineas,
      });

      if (!resultado.ok) {
        setErrorGeneral(resultado.error);
        return;
      }
      if (!resultado.datos) {
        setErrorGeneral("No pudimos confirmar el borrador guardado.");
        return;
      }

      const errorSubida = await subirComprobante(resultado.datos.id);
      toast.success(
        errorSubida
          ? `${resultado.mensaje} El comprobante no se pudo subir: ${errorSubida}`
          : resultado.mensaje,
      );
      setRenglonesReferencia(renglones);
      onOpenChange(false);
    } finally {
      enviandoRef.current = false;
      setGuardando(false);
    }
  }

  const campoNcfPropio = rncPropio ? (
    <FormField
      label="Tipo de comprobante propio"
      htmlFor="documento-tipo-ncf-propio"
    >
      <SelectCampo
        id="documento-tipo-ncf-propio"
        opciones={COMPROBANTES_PROPIOS}
        valor={form.tipoNcf || "B13"}
        onCambio={(valor) => actualizar("tipoNcf", valor)}
        requerido
        aria-label="Tipo de comprobante propio"
      />
    </FormField>
  ) : null;

  const buscadorProveedor = !venta ? (
    <FormField
      label="Buscar proveedor por RNC/cédula"
      htmlFor="documento-rnc-busqueda"
      className="sm:col-span-2"
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <Input
            id="documento-rnc-busqueda"
            inputMode="numeric"
            placeholder="Escribe el RNC y se completa el proveedor"
            value={rncBusqueda}
            onChange={(evento) => setRncBusqueda(evento.target.value)}
            className="min-w-0 flex-1"
          />
          <Button
            type="button"
            variant="outline"
            className="h-9 whitespace-nowrap"
            disabled={buscandoRnc}
            onClick={() => void buscarProveedor()}
          >
            {buscandoRnc ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              <IconSearch className="size-4" />
            )}
            Buscar
          </Button>
        </div>
        {estadoRnc ? (
          <p className="text-xs text-muted-foreground">{estadoRnc}</p>
        ) : null}
      </div>
    </FormField>
  ) : null;

  const bloqueRenglones = !nota ? (
    <>
      <div className="sm:col-span-2">
        <label
          htmlFor="documento-detallar"
          className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground"
        >
          <Checkbox
            id="documento-detallar"
            checked={form.detallar}
            onCheckedChange={(valor) => {
              const activo = valor === true;
              actualizar("detallar", activo);
              if (activo && renglones.length === 0) agregarRenglon();
            }}
          />
          {venta
            ? "Detallar en renglones (varias cuentas de ingreso / descontar inventario)"
            : "Detallar en renglones (varias cuentas / enviar a inventario)"}
        </label>
      </div>
      {form.detallar ? (
        <div className="rounded-[12px] border border-border bg-muted/30 p-3 sm:col-span-2">
          <div className="flex flex-col gap-2">
            {renglones.map((linea, indice) => (
              <div
                key={linea.id}
                className="grid grid-cols-2 items-center gap-2 rounded-[10px] border border-border/70 bg-card p-2 sm:grid-cols-[104px_minmax(0,1fr)_64px_80px_86px_28px] sm:border-0 sm:bg-transparent sm:p-0"
              >
                <SelectCampo
                  opciones={[
                    { value: "account", label: "Cuenta" },
                    { value: "item", label: "Artículo" },
                  ]}
                  valor={linea.modo}
                  onCambio={(valor) =>
                    actualizarRenglon(linea.id, {
                      modo: valor === "item" ? "item" : "account",
                    })
                  }
                  aria-label={`Tipo de renglón ${indice + 1}`}
                />
                {linea.modo === "item" ? (
                  <>
                    <SelectCampo
                      opciones={opcionesArticulos}
                      valor={linea.articuloId}
                      onCambio={(valor) =>
                        actualizarRenglon(linea.id, { articuloId: valor })
                      }
                      etiquetaVacia="Artículo"
                      buscable
                      aria-label={`Artículo del renglón ${indice + 1}`}
                    />
                    <Input
                      inputMode="decimal"
                      placeholder="Cant."
                      value={linea.cantidad}
                      onChange={(evento) =>
                        actualizarRenglon(linea.id, {
                          cantidad: evento.target.value,
                        })
                      }
                      aria-label={`Cantidad del renglón ${indice + 1}`}
                      className="tabular-nums"
                    />
                    <Input
                      inputMode="decimal"
                      placeholder={venta ? "Precio" : "C.unit"}
                      value={linea.precio}
                      onChange={(evento) =>
                        actualizarRenglon(linea.id, {
                          precio: evento.target.value,
                        })
                      }
                      aria-label={`Precio del renglón ${indice + 1}`}
                      className="tabular-nums"
                    />
                  </>
                ) : (
                  <SelectCampo
                    opciones={opcionesCuentaPrincipal}
                    valor={linea.cuentaId}
                    onCambio={(valor) =>
                      actualizarRenglon(linea.id, { cuentaId: valor })
                    }
                    etiquetaVacia="Cuenta"
                    buscable
                    className="sm:col-span-3"
                    aria-label={`Cuenta del renglón ${indice + 1}`}
                  />
                )}
                <Input
                  inputMode="decimal"
                  placeholder="Monto"
                  value={linea.monto}
                  readOnly={linea.modo === "item"}
                  onChange={(evento) =>
                    actualizarRenglon(linea.id, { monto: evento.target.value })
                  }
                  aria-label={`Monto del renglón ${indice + 1}`}
                  className="tabular-nums"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-7 text-muted-foreground"
                  onClick={() => quitarRenglon(linea.id)}
                  aria-label={`Quitar renglón ${indice + 1}`}
                >
                  <IconTrash className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 whitespace-nowrap"
              onClick={agregarRenglon}
            >
              <IconPlus className="size-4" />
              Agregar renglón
            </Button>
            <p className="text-sm font-semibold tabular-nums">
              Subtotal renglones: {formatearMoneda(subtotalRenglones)}
            </p>
          </div>
        </div>
      ) : null}
    </>
  ) : null;

  const camposCompraFiscales = compraFactura ? (
    <>
      <FormField label="ITBIS retenido" htmlFor="documento-itbis-retenido">
        <Input
          id="documento-itbis-retenido"
          inputMode="decimal"
          value={form.retencionItbis}
          onChange={(evento) =>
            actualizar("retencionItbis", evento.target.value)
          }
          className="tabular-nums"
        />
      </FormField>
      <FormField label="Retenciones totales" htmlFor="documento-retenciones">
        <div className="flex flex-col gap-1">
          <Input
            id="documento-retenciones"
            inputMode="decimal"
            value={form.retenciones}
            onChange={(evento) =>
              actualizar("retenciones", evento.target.value)
            }
            className="tabular-nums"
          />
          <p className="text-xs text-muted-foreground">
            Incluye las retenciones informadas abajo.
          </p>
        </div>
      </FormField>
      <FormField label="ISR retenido" htmlFor="documento-isr-retenido">
        <Input
          id="documento-isr-retenido"
          inputMode="decimal"
          value={form.retencionIsr}
          onChange={(evento) => actualizar("retencionIsr", evento.target.value)}
          className="tabular-nums"
        />
      </FormField>
      <FormField
        label="Tipo de retención ISR (606)"
        htmlFor="documento-tipo-retencion-isr"
      >
        <SelectCampo
          id="documento-tipo-retencion-isr"
          opciones={TIPOS_RETENCION_ISR.map(([value, label]) => ({
            value,
            label,
          }))}
          valor={form.tipoRetencionIsr}
          onCambio={(valor) => actualizar("tipoRetencionIsr", valor)}
          etiquetaVacia="Selecciona si aplica"
          aria-label="Tipo de retención ISR"
        />
      </FormField>
      <FormField
        label="Fecha de pago de retenciones"
        htmlFor="documento-fecha-retenciones"
      >
        <DatePicker
          id="documento-fecha-retenciones"
          value={form.fechaPagoRetenciones}
          onChange={(valor) => actualizar("fechaPagoRetenciones", valor)}
          permitirLimpiar
        />
      </FormField>
      <FormField label="Otros impuestos" htmlFor="documento-otros-impuestos">
        <Input
          id="documento-otros-impuestos"
          inputMode="decimal"
          value={form.otrosImpuestos}
          onChange={(evento) =>
            actualizar("otrosImpuestos", evento.target.value)
          }
          className="tabular-nums"
        />
      </FormField>
    </>
  ) : null;

  return (
    <>
      <Dialog
        open={abierto}
        onOpenChange={(siguienteAbierto, detalles) =>
          solicitarCierre(siguienteAbierto, () => detalles.cancel())
        }
      >
        <DialogContent className="flex max-h-[92vh] w-full max-w-[calc(100%-1rem)] flex-col overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="border-b border-border px-5 pt-5 pb-4">
            <DialogTitle className="flex items-center gap-2">
              {venta ? (
                <IconFileInvoice className="size-5 text-primary" />
              ) : (
                <IconReceipt2 className="size-5 text-primary" />
              )}
              {tituloModo(modo, editando)}
            </DialogTitle>
            <DialogDescription>
              Guarda primero el borrador; luego podrás editarlo, asignar
              comprobante a una proforma o contabilizarlo.
            </DialogDescription>
          </DialogHeader>

          <form
            id="documento-formulario"
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={guardar}
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <FormGrid className="lg:grid-cols-2">
                <FormField
                  label="Número interno"
                  htmlFor="documento-numero"
                  required
                >
                  <Input
                    id="documento-numero"
                    value={form.numero}
                    onChange={(evento) =>
                      actualizar("numero", evento.target.value)
                    }
                    placeholder={
                      venta
                        ? "FV-2026-0001"
                        : nota
                          ? "NC-2026-0001"
                          : "G-2026-0001"
                    }
                    maxLength={40}
                    required
                  />
                </FormField>
                <FormField
                  label={compraFactura && !rncPropio ? "NCF *" : "NCF"}
                  htmlFor="documento-ncf"
                >
                  <div className="flex flex-col gap-1">
                    <Input
                      id="documento-ncf"
                      value={form.ncf}
                      onChange={(evento) =>
                        actualizar("ncf", evento.target.value.toUpperCase())
                      }
                      placeholder={
                        facturaVenta
                          ? "Se asigna según la secuencia seleccionada"
                          : rncPropio
                            ? "Se asigna automáticamente"
                            : "NCF del proveedor"
                      }
                      disabled={facturaVenta && form.proforma}
                      className="uppercase placeholder:normal-case"
                    />
                    {rncPropio ? (
                      <p className="text-xs text-muted-foreground">
                        RNC propio: se generará B13/B11 de tu secuencia interna.
                      </p>
                    ) : null}
                  </div>
                </FormField>

                {campoNcfPropio}

                {facturaVenta && !form.proforma ? (
                  <FormField
                    label="Tipo de comprobante"
                    htmlFor="documento-tipo-ncf"
                  >
                    <SelectCampo
                      id="documento-tipo-ncf"
                      opciones={opcionesComprobanteVenta}
                      valor={form.tipoNcf || "B01"}
                      onCambio={(valor) => actualizar("tipoNcf", valor)}
                      requerido
                      aria-label="Tipo de comprobante"
                    />
                  </FormField>
                ) : null}

                {facturaVenta ? (
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="documento-proforma"
                      className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-medium"
                    >
                      <Checkbox
                        id="documento-proforma"
                        checked={form.proforma}
                        onCheckedChange={(valor) =>
                          actualizar("proforma", valor === true)
                        }
                      />
                      Guardar como factura proforma sin NCF
                    </label>
                    <p className="mt-1 pl-6 text-xs text-muted-foreground">
                      Podrás asignar B01, B02, B14, B15 o una serie electrónica
                      activa después, antes de contabilizarla.
                    </p>
                  </div>
                ) : null}

                {buscadorProveedor}

                <FormField
                  label={venta ? "Cliente" : "Proveedor"}
                  htmlFor="documento-tercero"
                  required
                  className="sm:col-span-2"
                >
                  <SelectCampo
                    id="documento-tercero"
                    opciones={opcionesTerceros}
                    valor={form.terceroId}
                    onCambio={(valor) => actualizar("terceroId", valor)}
                    etiquetaVacia={
                      venta ? "Selecciona cliente" : "Selecciona proveedor"
                    }
                    buscable
                    requerido
                    aria-label={venta ? "Cliente" : "Proveedor"}
                  />
                </FormField>

                {nota ? (
                  <FormField
                    label="Factura original"
                    htmlFor="documento-acreditado"
                    required
                    className="sm:col-span-2"
                  >
                    <SelectCampo
                      id="documento-acreditado"
                      opciones={opcionesAcreditables}
                      valor={form.documentoAcreditadoId}
                      onCambio={(valor) =>
                        actualizar("documentoAcreditadoId", valor)
                      }
                      etiquetaVacia="Selecciona factura contabilizada con saldo"
                      buscable
                      requerido
                      aria-label="Factura original"
                    />
                  </FormField>
                ) : null}

                <FormField
                  label="Fecha de emisión"
                  htmlFor="documento-fecha-emision"
                  required
                >
                  <DatePicker
                    id="documento-fecha-emision"
                    value={form.fechaEmision}
                    onChange={(valor) => actualizar("fechaEmision", valor)}
                  />
                </FormField>
                <FormField
                  label="Fecha de vencimiento"
                  htmlFor="documento-fecha-vencimiento"
                  required
                >
                  <DatePicker
                    id="documento-fecha-vencimiento"
                    value={form.fechaVencimiento}
                    onChange={(valor) => actualizar("fechaVencimiento", valor)}
                  />
                </FormField>

                <FormField
                  label="Concepto"
                  htmlFor="documento-concepto"
                  required
                  className="sm:col-span-2"
                >
                  <Input
                    id="documento-concepto"
                    value={form.concepto}
                    onChange={(evento) =>
                      actualizar("concepto", evento.target.value)
                    }
                    maxLength={500}
                    required
                  />
                </FormField>

                {compraFactura ? (
                  <>
                    <FormField
                      label="Comprobante de soporte (opcional)"
                      htmlFor="documento-comprobante"
                      className="sm:col-span-2"
                    >
                      <div className="flex flex-col gap-1">
                        <Input
                          id="documento-comprobante"
                          type="file"
                          accept="application/pdf,image/jpeg,image/png,image/webp"
                          onChange={(evento) =>
                            setComprobante(evento.target.files?.[0] ?? null)
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          {comprobante
                            ? `Seleccionado: ${comprobante.name}`
                            : "PDF o imagen · máximo 900 KB"}
                        </p>
                      </div>
                    </FormField>
                    <FormField
                      label="Tipo de gasto (DGII 606)"
                      htmlFor="documento-tipo-gasto"
                      className="sm:col-span-2"
                    >
                      <SelectCampo
                        id="documento-tipo-gasto"
                        opciones={TIPOS_GASTO_DGII.map(([value, label]) => ({
                          value,
                          label,
                        }))}
                        valor={form.tipoGasto}
                        onCambio={(valor) => actualizar("tipoGasto", valor)}
                        etiquetaVacia="Selecciona el tipo"
                        aria-label="Tipo de gasto DGII"
                      />
                    </FormField>
                  </>
                ) : modo === "nota_credito_compra" ? (
                  <FormField
                    label="Tipo de gasto (DGII 606)"
                    htmlFor="documento-tipo-gasto"
                    className="sm:col-span-2"
                  >
                    <SelectCampo
                      id="documento-tipo-gasto"
                      opciones={TIPOS_GASTO_DGII.map(([value, label]) => ({
                        value,
                        label,
                      }))}
                      valor={form.tipoGasto}
                      onCambio={(valor) => actualizar("tipoGasto", valor)}
                      etiquetaVacia="Selecciona el tipo"
                      aria-label="Tipo de gasto DGII"
                    />
                  </FormField>
                ) : null}

                {bloqueRenglones}

                {!form.detallar ? (
                  <FormField
                    label="Subtotal"
                    htmlFor="documento-subtotal"
                    required
                  >
                    <Input
                      id="documento-subtotal"
                      inputMode="decimal"
                      value={form.subtotal}
                      onChange={(evento) =>
                        cambiarSubtotal(evento.target.value)
                      }
                      className="tabular-nums"
                      required
                    />
                  </FormField>
                ) : null}
                <FormField label="ITBIS" htmlFor="documento-itbis">
                  <Input
                    id="documento-itbis"
                    inputMode="decimal"
                    value={form.impuesto}
                    onChange={(evento) => {
                      setImpuestoManual(true);
                      actualizar("impuesto", evento.target.value);
                    }}
                    className="tabular-nums"
                  />
                </FormField>

                {!compraFactura ? (
                  <FormField
                    label="Retenciones"
                    htmlFor="documento-retenciones"
                  >
                    <Input
                      id="documento-retenciones"
                      inputMode="decimal"
                      value={form.retenciones}
                      onChange={(evento) =>
                        actualizar("retenciones", evento.target.value)
                      }
                      className="tabular-nums"
                    />
                  </FormField>
                ) : null}
                {camposCompraFiscales}

                <FormField label="Total bruto" htmlFor="documento-total">
                  <Input
                    id="documento-total"
                    value={total.toFixed(2)}
                    readOnly
                    disabled
                    className="tabular-nums font-semibold"
                  />
                </FormField>

                {!form.detallar ? (
                  <FormField
                    label={venta ? "Ingreso" : "Gasto o costo"}
                    htmlFor="documento-cuenta"
                    required
                  >
                    <SelectCampo
                      id="documento-cuenta"
                      opciones={opcionesCuentaPrincipal}
                      valor={form.cuentaId}
                      onCambio={(valor) => actualizar("cuentaId", valor)}
                      etiquetaVacia="Selecciona cuenta"
                      buscable
                      requerido
                      aria-label={
                        venta ? "Cuenta de ingreso" : "Cuenta de gasto o costo"
                      }
                    />
                  </FormField>
                ) : null}

                {compraFactura ? (
                  <FormField
                    label="Forma de pago"
                    htmlFor="documento-metodo-pago"
                    required
                  >
                    <div className="flex flex-col gap-1">
                      <SelectCampo
                        id="documento-metodo-pago"
                        opciones={opcionesMetodosPago}
                        valor={form.metodoPagoId}
                        onCambio={(valor) => actualizar("metodoPagoId", valor)}
                        etiquetaVacia="Selecciona forma de pago"
                        buscable
                        requerido
                        aria-label="Forma de pago"
                      />
                      {opcionesMetodosPago.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Configura primero las formas de pago en Contabilidad →
                          Formas de pago.
                        </p>
                      ) : null}
                    </div>
                  </FormField>
                ) : (
                  <FormField
                    label={venta ? "Cuentas por cobrar" : "Cuentas por pagar"}
                    htmlFor="documento-cuenta-control"
                    required
                  >
                    <SelectCampo
                      id="documento-cuenta-control"
                      opciones={opcionesCuentaControl}
                      valor={form.cuentaControlId}
                      onCambio={(valor) => actualizar("cuentaControlId", valor)}
                      etiquetaVacia="Selecciona cuenta"
                      buscable
                      requerido
                      aria-label={
                        venta ? "Cuentas por cobrar" : "Cuentas por pagar"
                      }
                    />
                  </FormField>
                )}

                <FormField
                  label={
                    compraFactura
                      ? "Cuenta de ITBIS / impuestos"
                      : "Cuenta de ITBIS"
                  }
                  htmlFor="documento-cuenta-impuesto"
                >
                  <SelectCampo
                    id="documento-cuenta-impuesto"
                    opciones={opcionesCuentaImpuesto}
                    valor={form.cuentaImpuestoId}
                    onCambio={(valor) => actualizar("cuentaImpuestoId", valor)}
                    etiquetaVacia="Selecciona si aplica"
                    buscable
                    aria-label="Cuenta de ITBIS"
                  />
                </FormField>
                <FormField
                  label="Cuenta de retenciones"
                  htmlFor="documento-cuenta-retencion"
                >
                  <SelectCampo
                    id="documento-cuenta-retencion"
                    opciones={opcionesCuentaRetencion}
                    valor={form.cuentaRetencionId}
                    onCambio={(valor) => {
                      setCuentaRetencionManual(true);
                      actualizar("cuentaRetencionId", valor);
                    }}
                    etiquetaVacia="Selecciona si aplica"
                    buscable
                    aria-label="Cuenta de retenciones"
                  />
                </FormField>
              </FormGrid>

              {errorGeneral ? (
                <p
                  role="alert"
                  className="mt-4 rounded-[10px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {errorGeneral}
                </p>
              ) : null}
            </div>

            <DialogFooter className="mt-0">
              <Button
                type="button"
                variant="outline"
                disabled={guardando}
                className="h-9 whitespace-nowrap"
                onClick={() => solicitarCierre(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={guardando}
                className="h-9 whitespace-nowrap"
              >
                {guardando ? (
                  <>
                    <IconLoader2 className="size-4 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  "Guardar borrador"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DialogoConfirmarDescarte
        abierto={confirmandoDescarte}
        onOpenChange={setConfirmandoDescarte}
        onDescartar={descartarCambios}
      />
    </>
  );
}
