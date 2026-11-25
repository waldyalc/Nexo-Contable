import type { Fila606, Fila607 } from "@/lib/dgii/exportar-606-607";
import { hoySantoDomingo } from "@/lib/formato";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

import type {
  ArticuloDocumento,
  ConfiguracionFiscalListado,
  CuentaOpcion,
  DocumentoListado,
  EstadoCobro,
  EstadoDocumento,
  MetodoPagoOpcion,
  ObligacionFiscalListado,
  PagoListado,
  ReglaFiscalListado,
  SaldoAntiguedad,
  SecuenciaNcfListado,
  TerceroListado,
  TipoDocumentoFinanciero,
  TipoTercero,
} from "./tipos";

/**
 * Lecturas del servidor para los módulos de operaciones. Todas las consultas
 * se acotan con `range` (o `paginarConsulta`) para no sufrir el truncamiento
 * silencioso de PostgREST a 1,000 filas.
 */

interface TerceroFila {
  id: string;
  tipo: string;
  nombre: string;
  rnc: string;
  correo: string;
  telefono: string;
  direccion: string;
  activo: boolean;
  cuenta_por_pagar_id: string | null;
  cuenta_por_cobrar_id: string | null;
}

interface CuentaFila {
  id: string;
  codigo: string;
  nombre: string;
  clasificacion: string;
}

interface MetodoPagoFila {
  id: string;
  nombre: string;
  cuenta_id: string;
  deja_cxp_proveedor: boolean;
  activo: boolean;
}

interface SecuenciaFila {
  id: string;
  tipo_comprobante: string;
  serie: string;
  prefijo: string;
  numero_inicial: number;
  numero_final: number;
  numero_actual: number;
  fecha_vencimiento: string | null;
  activo: boolean;
}

interface DocumentoFila {
  id: string;
  tipo: string;
  numero: string;
  ncf: string;
  tipo_ncf: string;
  tercero_id: string;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  concepto: string;
  subtotal: number;
  impuesto: number;
  retenciones: number;
  total: number;
  estado: string;
  documento_acreditado_id: string | null;
  otros_impuestos: number;
  cuenta_id: string;
  cuenta_control_id: string;
  cuenta_impuesto_id: string | null;
  cuenta_retencion_id: string | null;
  detalles_fiscales: unknown;
}

interface ArticuloDocumentoFila {
  id: string;
  sku: string;
  nombre: string;
  precio_venta: number;
  costo_promedio: number;
  cuenta_inventario_id: string | null;
  cuenta_costo_id: string | null;
  cuenta_ingreso_id: string | null;
}

interface PagoFila {
  id: string;
  documento_id: string;
  fecha_pago: string;
  monto: number;
  metodo_pago: string;
  cuenta_id: string;
  referencia: string;
  estado: string;
}

interface TerceroNombreFila {
  id: string;
  nombre: string;
}

interface ConfiguracionFiscalFila {
  tasa_itbis_bps: number;
  retencion_isr_servicios_bps: number;
  retencion_itbis_servicios_bps: number;
  cuenta_itbis_adelantado_id: string | null;
  cuenta_itbis_por_pagar_id: string | null;
  cuenta_retencion_isr_id: string | null;
  cuenta_retencion_itbis_id: string | null;
  cuenta_cxc_default_id: string | null;
  cuenta_cxp_default_id: string | null;
}

interface ReglaFiscalFila {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  tasa_bps: number;
  cuenta_id: string | null;
  activa: boolean;
}

interface ObligacionFila {
  id: string;
  codigo_formulario: string;
  periodo: string;
  fecha_limite: string;
  estado: string;
  monto_declarado: number;
  referencia_presentacion: string;
  presentado_en: string | null;
}

interface AntiguedadFila {
  documento_id: string;
  numero: string;
  tercero_id: string;
  tercero: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  dias_vencido: number;
  saldo: number;
  bucket: string;
}

interface DocumentoDetalleFila {
  id: string;
  tipo: string;
  numero: string;
  ncf: string;
  tipo_ncf: string;
  tercero_id: string;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  concepto: string;
  subtotal: number;
  impuesto: number;
  retenciones: number;
  otros_impuestos: number;
  total: number;
  detalles_fiscales: unknown;
  estado: string;
  asiento_id: string | null;
  motivo_anulacion: string;
}

interface TerceroDetalleFila {
  id: string;
  tipo: string;
  nombre: string;
  rnc: string;
}

interface DocumentoCreditoTotalFila {
  id: string;
  total: number;
}

interface AsientoDetalleFila {
  id: string;
  numero: string;
  fecha: string;
  tipo_operacion: string;
  descripcion: string;
  referencia: string;
  estado: string;
}

interface AsientoLineaDetalleFila {
  id: string;
  linea: number;
  cuenta_id: string;
  descripcion: string;
  debito: number;
  credito: number;
}

function normalizarTipoTercero(valor: string): TipoTercero {
  if (valor === "customer" || valor === "supplier") return valor;
  return "both";
}

function normalizarEstadoDocumento(valor: string): EstadoDocumento {
  if (valor === "draft" || valor === "void") return valor;
  return "posted";
}

function estadoCobro(
  saldo: number,
  fechaVencimiento: string | null,
  estado: EstadoDocumento,
): EstadoCobro {
  if (estado === "void") return "pendiente";
  if (saldo <= 0.005) return "saldada";
  if (fechaVencimiento !== null && fechaVencimiento < hoySantoDomingo()) {
    return "vencida";
  }
  return "pendiente";
}

export interface DocumentoDetalleTercero {
  id: string;
  tipo: TipoTercero;
  tipoEtiqueta: string;
  nombre: string;
  rnc: string;
}

export interface DocumentoDetalleDocumento {
  id: string;
  tipo: TipoDocumentoFinanciero;
  numero: string;
  ncf: string;
  tipoNcf: string;
  fechaEmision: string;
  fechaVencimiento: string | null;
  concepto: string;
  subtotal: number;
  impuesto: number;
  retenciones: number;
  retencionIsr: number;
  retencionItbis: number;
  otrasRetenciones: number;
  otrosImpuestos: number;
  total: number;
  pagado: number;
  acreditado: number;
  saldo: number;
  estado: EstadoDocumento;
  estadoCobro: EstadoCobro;
  estadoEtiqueta: string;
  motivoAnulacion: string;
}

export interface DocumentoDetallePago {
  id: string;
  fechaPago: string;
  metodoPago: string;
  monto: number;
  referencia: string;
}

export interface DocumentoDetalleLineaAsiento {
  id: string;
  linea: number;
  cuentaCodigo: string;
  cuentaNombre: string;
  descripcion: string;
  debito: number;
  credito: number;
}

export interface DocumentoDetalleAsiento {
  id: string;
  numero: string;
  fecha: string;
  tipoOperacion: string;
  descripcion: string;
  referencia: string;
  estado: string;
  estadoEtiqueta: string;
  lineas: DocumentoDetalleLineaAsiento[];
}

export interface DocumentoDetalleCompleto {
  documento: DocumentoDetalleDocumento;
  tercero: DocumentoDetalleTercero;
  pagos: DocumentoDetallePago[];
  asiento: DocumentoDetalleAsiento | null;
}

export type ResultadoDocumentoDetalle =
  | { ok: true; detalle: DocumentoDetalleCompleto }
  | { ok: false; error: string };

export type CargadorDocumentoDetalle = (
  empresaId: string,
  documentoId: string,
) => Promise<ResultadoDocumentoDetalle>;

function normalizarTipoDocumentoFinanciero(
  valor: string,
): TipoDocumentoFinanciero {
  if (
    valor === "sales_invoice" ||
    valor === "purchase_invoice" ||
    valor === "sales_credit" ||
    valor === "purchase_credit"
  ) {
    return valor;
  }
  throw new Error(`Tipo de documento financiero desconocido: ${valor}`);
}

function etiquetaTipoTercero(tipo: TipoTercero): string {
  if (tipo === "customer") return "Cliente";
  if (tipo === "supplier") return "Proveedor";
  return "Cliente y proveedor";
}

function etiquetaEstadoAsiento(estado: string): string {
  if (estado === "draft") return "Borrador";
  if (estado === "reversed") return "Revertido";
  if (estado === "reversal") return "Reverso";
  return "Contabilizado";
}

function objetoDesdeJson(valor: unknown): Record<string, unknown> {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    return {};
  }
  return valor as Record<string, unknown>;
}

function numeroDesdeJson(valor: unknown): number {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : 0;
  }

  if (typeof valor === "string") {
    const limpio = valor.trim().replace(/\s/g, "").replace(/,/g, "");
    if (limpio === "") return 0;
    const numero = Number(limpio);
    return Number.isFinite(numero) ? numero : 0;
  }

  return 0;
}

function redondearMoneda(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export async function cargarTerceros(
  empresaId: string,
  tipos: readonly TipoTercero[] = ["customer", "supplier", "both"],
): Promise<TerceroListado[]> {
  const supabase = await createClient();

  const filas = await paginarConsulta<TerceroFila>(async (desde, hasta) => {
    const { data, error } = await supabase
      .from("terceros")
      .select(
        "id, tipo, nombre, rnc, correo, telefono, direccion, activo, cuenta_por_pagar_id, cuenta_por_cobrar_id",
      )
      .eq("empresa_id", empresaId)
      .in("tipo", [...tipos])
      .order("nombre", { ascending: true })
      .order("id", { ascending: true })
      .range(desde, hasta);
    return { data: (data as TerceroFila[] | null) ?? null, error };
  });

  return filas.map((fila) => ({
    id: fila.id,
    tipo: normalizarTipoTercero(fila.tipo),
    nombre: fila.nombre,
    rnc: fila.rnc,
    correo: fila.correo,
    telefono: fila.telefono,
    direccion: fila.direccion,
    activo: fila.activo,
    cuentaPorPagarId: fila.cuenta_por_pagar_id,
    cuentaPorCobrarId: fila.cuenta_por_cobrar_id,
  }));
}

export async function cargarCuentas(
  empresaId: string,
): Promise<CuentaOpcion[]> {
  const supabase = await createClient();

  const filas = await paginarConsulta<CuentaFila>(async (desde, hasta) => {
    const { data, error } = await supabase
      .from("cuentas")
      .select("id, codigo, nombre, clasificacion")
      .eq("empresa_id", empresaId)
      .eq("activa", true)
      .eq("es_agrupacion", false)
      .order("codigo", { ascending: true })
      .range(desde, hasta);
    return { data: (data as CuentaFila[] | null) ?? null, error };
  });

  return filas.map((fila) => ({
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    clasificacion: fila.clasificacion,
  }));
}

export async function cargarMetodosPago(
  empresaId: string,
): Promise<MetodoPagoOpcion[]> {
  const supabase = await createClient();

  const filas = await paginarConsulta<MetodoPagoFila>(async (desde, hasta) => {
    const { data, error } = await supabase
      .from("metodos_pago")
      .select("id, nombre, cuenta_id, deja_cxp_proveedor, activo")
      .eq("empresa_id", empresaId)
      .order("nombre", { ascending: true })
      .order("id", { ascending: true })
      .range(desde, hasta);
    return { data: (data as MetodoPagoFila[] | null) ?? null, error };
  });

  return filas.map((fila) => ({
    id: fila.id,
    nombre: fila.nombre,
    cuentaId: fila.cuenta_id,
    dejaCxpProveedor: fila.deja_cxp_proveedor,
    activo: fila.activo,
  }));
}

export async function cargarSecuenciasNcf(
  empresaId: string,
): Promise<SecuenciaNcfListado[]> {
  const supabase = await createClient();

  const filas = await paginarConsulta<SecuenciaFila>(async (desde, hasta) => {
    const { data, error } = await supabase
      .from("secuencias_ncf")
      .select(
        "id, tipo_comprobante, serie, prefijo, numero_inicial, numero_final, numero_actual, fecha_vencimiento, activo",
      )
      .eq("empresa_id", empresaId)
      .order("tipo_comprobante", { ascending: true })
      .order("prefijo", { ascending: true })
      .range(desde, hasta);
    return { data: (data as SecuenciaFila[] | null) ?? null, error };
  });

  return filas.map((fila) => ({
    id: fila.id,
    tipoComprobante: fila.tipo_comprobante,
    serie: fila.serie === "E" ? "E" : "B",
    prefijo: fila.prefijo,
    numeroInicial: Number(fila.numero_inicial),
    numeroFinal: Number(fila.numero_final),
    numeroActual: Number(fila.numero_actual),
    fechaVencimiento: fila.fecha_vencimiento,
    activo: fila.activo,
  }));
}

async function mapaNombresTerceros(
  empresaId: string,
): Promise<Map<string, string>> {
  const supabase = await createClient();

  const filas = await paginarConsulta<TerceroNombreFila>(
    async (desde, hasta) => {
      const { data, error } = await supabase
        .from("terceros")
        .select("id, nombre")
        .eq("empresa_id", empresaId)
        .order("id", { ascending: true })
        .range(desde, hasta);
      return { data: (data as TerceroNombreFila[] | null) ?? null, error };
    },
  );

  return new Map(filas.map((fila) => [fila.id, fila.nombre]));
}

async function cargarPagosInterno(empresaId: string): Promise<PagoFila[]> {
  const supabase = await createClient();

  return await paginarConsulta<PagoFila>(async (desde, hasta) => {
    const { data, error } = await supabase
      .from("documento_pagos")
      .select(
        "id, documento_id, fecha_pago, monto, metodo_pago, cuenta_id, referencia, estado",
      )
      .eq("empresa_id", empresaId)
      .order("fecha_pago", { ascending: false })
      .order("id", { ascending: true })
      .range(desde, hasta);
    return { data: (data as PagoFila[] | null) ?? null, error };
  });
}

export interface DatosDocumentos {
  documentos: DocumentoListado[];
  pagos: PagoListado[];
  cuentas: CuentaOpcion[];
}

/**
 * Documentos financieros con su saldo pendiente y sus pagos. El saldo se
 * calcula igual que en el motor contable: total − pagos activos.
 */
export async function cargarDocumentos(
  empresaId: string,
  tipos: readonly TipoDocumentoFinanciero[],
): Promise<DatosDocumentos> {
  const supabase = await createClient();

  const [filasDocumentos, filasPagos, nombres, cuentas] = await Promise.all([
    paginarConsulta<DocumentoFila>(async (desde, hasta) => {
      const { data, error } = await supabase
        .from("documentos_financieros")
        .select(
          "id, tipo, numero, ncf, tipo_ncf, tercero_id, fecha_emision, fecha_vencimiento, concepto, subtotal, impuesto, total, estado, documento_acreditado_id, retenciones, otros_impuestos, cuenta_id, cuenta_control_id, cuenta_impuesto_id, cuenta_retencion_id, detalles_fiscales",
        )
        .eq("empresa_id", empresaId)
        .in("tipo", [...tipos])
        .order("fecha_emision", { ascending: false })
        .order("numero", { ascending: false })
        .range(desde, hasta);
      return { data: (data as DocumentoFila[] | null) ?? null, error };
    }),
    cargarPagosInterno(empresaId),
    mapaNombresTerceros(empresaId),
    cargarCuentas(empresaId),
  ]);

  const nombresCuentas = new Map(cuentas.map((cuenta) => [cuenta.id, cuenta]));

  const pagadoPorDocumento = new Map<string, number>();
  for (const pago of filasPagos) {
    if (pago.estado !== "active") continue;
    pagadoPorDocumento.set(
      pago.documento_id,
      (pagadoPorDocumento.get(pago.documento_id) ?? 0) + Number(pago.monto),
    );
  }

  // Las notas de crédito contabilizadas reducen el saldo del documento que
  // acreditan, igual que en reporte_antiguedad_saldos.
  const acreditadoPorDocumento = new Map<string, number>();
  for (const fila of filasDocumentos) {
    if (fila.estado !== "posted") continue;
    if (!fila.tipo.endsWith("_credit")) continue;
    if (fila.documento_acreditado_id === null) continue;
    acreditadoPorDocumento.set(
      fila.documento_acreditado_id,
      (acreditadoPorDocumento.get(fila.documento_acreditado_id) ?? 0) +
        Number(fila.total),
    );
  }

  const documentos: DocumentoListado[] = filasDocumentos.map((fila) => {
    const total = Number(fila.total);
    const pagado = pagadoPorDocumento.get(fila.id) ?? 0;
    const acreditado = acreditadoPorDocumento.get(fila.id) ?? 0;
    const saldo =
      fila.estado === "void" ? 0 : Math.max(total - pagado - acreditado, 0);
    const estado = normalizarEstadoDocumento(fila.estado);

    return {
      id: fila.id,
      tipo: fila.tipo as TipoDocumentoFinanciero,
      numero: fila.numero,
      ncf: fila.ncf,
      tipoNcf: fila.tipo_ncf,
      terceroId: fila.tercero_id,
      tercero: nombres.get(fila.tercero_id) ?? "—",
      fechaEmision: fila.fecha_emision,
      fechaVencimiento: fila.fecha_vencimiento,
      concepto: fila.concepto,
      subtotal: Number(fila.subtotal),
      impuesto: Number(fila.impuesto),
      retenciones: Number(fila.retenciones),
      otrosImpuestos: Number(fila.otros_impuestos),
      total,
      pagado,
      saldo,
      estado,
      estadoCobro: estadoCobro(saldo, fila.fecha_vencimiento, estado),
      cuentaId: fila.cuenta_id,
      cuentaControlId: fila.cuenta_control_id,
      cuentaImpuestoId: fila.cuenta_impuesto_id,
      cuentaRetencionId: fila.cuenta_retencion_id,
      documentoAcreditadoId: fila.documento_acreditado_id,
      detallesFiscales: objetoDesdeJson(fila.detalles_fiscales),
    };
  });

  const pagos: PagoListado[] = filasPagos.map((fila) => {
    const cuenta = nombresCuentas.get(fila.cuenta_id);
    return {
      id: fila.id,
      documentoId: fila.documento_id,
      fechaPago: fila.fecha_pago,
      monto: Number(fila.monto),
      metodoPago: fila.metodo_pago,
      cuentaId: fila.cuenta_id,
      cuenta: cuenta ? `${cuenta.codigo} · ${cuenta.nombre}` : "—",
      referencia: fila.referencia,
      estado: fila.estado === "cancelled" ? "cancelled" : "active",
    };
  });

  return { documentos, pagos, cuentas };
}

export async function cargarArticulosDocumento(
  empresaId: string,
): Promise<ArticuloDocumento[]> {
  const supabase = await createClient();

  const filas = await paginarConsulta<ArticuloDocumentoFila>(
    async (desde, hasta) => {
      const { data, error } = await supabase
        .from("articulos_inventario")
        .select(
          "id, sku, nombre, precio_venta, costo_promedio, cuenta_inventario_id, cuenta_costo_id, cuenta_ingreso_id",
        )
        .eq("empresa_id", empresaId)
        .eq("activo", true)
        .order("sku", { ascending: true })
        .order("id", { ascending: true })
        .range(desde, hasta);
      return { data: (data as ArticuloDocumentoFila[] | null) ?? null, error };
    },
  );

  return filas.map((fila) => ({
    id: fila.id,
    sku: fila.sku,
    nombre: fila.nombre,
    precioVenta: Number(fila.precio_venta),
    costoPromedio: Number(fila.costo_promedio),
    cuentaInventarioId: fila.cuenta_inventario_id,
    cuentaCostoId: fila.cuenta_costo_id,
    cuentaIngresoId: fila.cuenta_ingreso_id,
  }));
}

export async function cargarDocumentoDetalle(
  empresaId: string,
  documentoId: string,
): Promise<DocumentoDetalleCompleto> {
  const supabase = await createClient();

  const { data: dataDocumento, error: errorDocumento } = await supabase
    .from("documentos_financieros")
    .select(
      "id, tipo, numero, ncf, tipo_ncf, tercero_id, fecha_emision, fecha_vencimiento, concepto, subtotal, impuesto, retenciones, otros_impuestos, total, detalles_fiscales, estado, asiento_id, motivo_anulacion",
    )
    .eq("empresa_id", empresaId)
    .eq("id", documentoId)
    .maybeSingle();

  if (errorDocumento) throw new Error(errorDocumento.message);

  const filaDocumento = dataDocumento as DocumentoDetalleFila | null;
  if (!filaDocumento) {
    throw new Error("Documento no encontrado o sin acceso a la empresa.");
  }

  const [respuestaTercero, filasPagos, filasCreditos] = await Promise.all([
    supabase
      .from("terceros")
      .select("id, tipo, nombre, rnc")
      .eq("empresa_id", empresaId)
      .eq("id", filaDocumento.tercero_id)
      .maybeSingle(),
    paginarConsulta<PagoFila>(async (desde, hasta) => {
      const { data, error } = await supabase
        .from("documento_pagos")
        .select(
          "id, documento_id, fecha_pago, monto, metodo_pago, cuenta_id, referencia, estado",
        )
        .eq("empresa_id", empresaId)
        .eq("documento_id", documentoId)
        .eq("estado", "active")
        .order("fecha_pago", { ascending: true })
        .order("id", { ascending: true })
        .range(desde, hasta);
      return { data: (data as PagoFila[] | null) ?? null, error };
    }),
    paginarConsulta<DocumentoCreditoTotalFila>(async (desde, hasta) => {
      const { data, error } = await supabase
        .from("documentos_financieros")
        .select("id, total")
        .eq("empresa_id", empresaId)
        .eq("documento_acreditado_id", documentoId)
        .eq("estado", "posted")
        .order("id", { ascending: true })
        .range(desde, hasta);
      return {
        data: (data as DocumentoCreditoTotalFila[] | null) ?? null,
        error,
      };
    }),
  ]);

  if (respuestaTercero.error) throw new Error(respuestaTercero.error.message);

  const filaTercero = respuestaTercero.data as TerceroDetalleFila | null;
  if (!filaTercero) {
    throw new Error("El tercero del documento no está disponible.");
  }

  const pagado = redondearMoneda(
    filasPagos.reduce((total, pago) => total + Number(pago.monto), 0),
  );
  const acreditado = redondearMoneda(
    filasCreditos.reduce((total, credito) => total + Number(credito.total), 0),
  );
  const total = redondearMoneda(Number(filaDocumento.total));
  const estado = normalizarEstadoDocumento(filaDocumento.estado);
  const saldo =
    estado === "void"
      ? 0
      : redondearMoneda(Math.max(total - pagado - acreditado, 0));
  const cobro = estadoCobro(saldo, filaDocumento.fecha_vencimiento, estado);
  const detallesFiscales = objetoDesdeJson(filaDocumento.detalles_fiscales);
  const retenciones = redondearMoneda(Number(filaDocumento.retenciones));
  const retencionIsr = redondearMoneda(
    numeroDesdeJson(detallesFiscales.retencion_isr),
  );
  const retencionItbis = redondearMoneda(
    numeroDesdeJson(detallesFiscales.retencion_itbis),
  );

  let asiento: DocumentoDetalleAsiento | null = null;

  if (filaDocumento.asiento_id !== null) {
    const { data: dataAsiento, error: errorAsiento } = await supabase
      .from("asientos")
      .select(
        "id, numero, fecha, tipo_operacion, descripcion, referencia, estado",
      )
      .eq("empresa_id", empresaId)
      .eq("id", filaDocumento.asiento_id)
      .maybeSingle();

    if (errorAsiento) throw new Error(errorAsiento.message);

    const filaAsiento = dataAsiento as AsientoDetalleFila | null;

    if (filaAsiento) {
      const filasLineas = await paginarConsulta<AsientoLineaDetalleFila>(
        async (desde, hasta) => {
          const { data, error } = await supabase
            .from("asiento_lineas")
            .select("id, linea, cuenta_id, descripcion, debito, credito")
            .eq("empresa_id", empresaId)
            .eq("asiento_id", filaAsiento.id)
            .order("linea", { ascending: true })
            .range(desde, hasta);
          return {
            data: (data as AsientoLineaDetalleFila[] | null) ?? null,
            error,
          };
        },
      );

      const idsCuentas = [
        ...new Set(filasLineas.map((linea) => linea.cuenta_id)),
      ];
      const cuentasFilas =
        idsCuentas.length === 0
          ? []
          : await paginarConsulta<CuentaFila>(async (desde, hasta) => {
              const { data, error } = await supabase
                .from("cuentas")
                .select("id, codigo, nombre, clasificacion")
                .eq("empresa_id", empresaId)
                .in("id", idsCuentas)
                .order("id", { ascending: true })
                .range(desde, hasta);
              return { data: (data as CuentaFila[] | null) ?? null, error };
            });
      const cuentasPorId = new Map(
        cuentasFilas.map((cuenta) => [cuenta.id, cuenta]),
      );

      asiento = {
        id: filaAsiento.id,
        numero: filaAsiento.numero,
        fecha: filaAsiento.fecha,
        tipoOperacion: filaAsiento.tipo_operacion,
        descripcion: filaAsiento.descripcion,
        referencia: filaAsiento.referencia,
        estado: filaAsiento.estado,
        estadoEtiqueta: etiquetaEstadoAsiento(filaAsiento.estado),
        lineas: filasLineas.map((linea) => {
          const cuenta = cuentasPorId.get(linea.cuenta_id);
          return {
            id: linea.id,
            linea: Number(linea.linea),
            cuentaCodigo: cuenta?.codigo ?? "—",
            cuentaNombre: cuenta?.nombre ?? "Cuenta no disponible",
            descripcion: linea.descripcion,
            debito: redondearMoneda(Number(linea.debito)),
            credito: redondearMoneda(Number(linea.credito)),
          };
        }),
      };
    }
  }

  const tipoTercero = normalizarTipoTercero(filaTercero.tipo);

  return {
    documento: {
      id: filaDocumento.id,
      tipo: normalizarTipoDocumentoFinanciero(filaDocumento.tipo),
      numero: filaDocumento.numero,
      ncf: filaDocumento.ncf,
      tipoNcf: filaDocumento.tipo_ncf,
      fechaEmision: filaDocumento.fecha_emision,
      fechaVencimiento: filaDocumento.fecha_vencimiento,
      concepto: filaDocumento.concepto,
      subtotal: redondearMoneda(Number(filaDocumento.subtotal)),
      impuesto: redondearMoneda(Number(filaDocumento.impuesto)),
      retenciones,
      retencionIsr,
      retencionItbis,
      otrasRetenciones: redondearMoneda(
        Math.max(retenciones - retencionIsr - retencionItbis, 0),
      ),
      otrosImpuestos: redondearMoneda(Number(filaDocumento.otros_impuestos)),
      total,
      pagado,
      acreditado,
      saldo,
      estado,
      estadoCobro: cobro,
      estadoEtiqueta: estado === "void" ? "anulada" : cobro,
      motivoAnulacion: filaDocumento.motivo_anulacion,
    },
    tercero: {
      id: filaTercero.id,
      tipo: tipoTercero,
      tipoEtiqueta: etiquetaTipoTercero(tipoTercero),
      nombre: filaTercero.nombre,
      rnc: filaTercero.rnc,
    },
    pagos: filasPagos.map((pago) => ({
      id: pago.id,
      fechaPago: pago.fecha_pago,
      metodoPago: pago.metodo_pago,
      monto: redondearMoneda(Number(pago.monto)),
      referencia: pago.referencia,
    })),
    asiento,
  };
}

export async function cargarAntiguedad(
  empresaId: string,
  tipo: "cxc" | "cxp",
  fechaCorte: string,
): Promise<SaldoAntiguedad[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("reporte_antiguedad_saldos", {
    p_empresa_id: empresaId,
    p_tipo: tipo,
    p_fecha_corte: fechaCorte,
  });

  if (error) throw new Error(error.message);

  const filas = (data ?? []) as AntiguedadFila[];

  return filas.map((fila) => ({
    documentoId: fila.documento_id,
    numero: fila.numero,
    terceroId: fila.tercero_id,
    tercero: fila.tercero,
    fechaEmision: fila.fecha_emision,
    fechaVencimiento: fila.fecha_vencimiento,
    diasVencido: Number(fila.dias_vencido),
    saldo: Number(fila.saldo),
    bucket: fila.bucket,
  }));
}

export async function cargarConfiguracionFiscal(
  empresaId: string,
): Promise<ConfiguracionFiscalListado> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("configuracion_fiscal")
    .select(
      "tasa_itbis_bps, retencion_isr_servicios_bps, retencion_itbis_servicios_bps, cuenta_itbis_adelantado_id, cuenta_itbis_por_pagar_id, cuenta_retencion_isr_id, cuenta_retencion_itbis_id, cuenta_cxc_default_id, cuenta_cxp_default_id",
    )
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const fila = data as ConfiguracionFiscalFila | null;

  return {
    tasaItbisBps: fila?.tasa_itbis_bps ?? 1800,
    retencionIsrServiciosBps: fila?.retencion_isr_servicios_bps ?? 1000,
    retencionItbisServiciosBps: fila?.retencion_itbis_servicios_bps ?? 3000,
    cuentaItbisAdelantadoId: fila?.cuenta_itbis_adelantado_id ?? null,
    cuentaItbisPorPagarId: fila?.cuenta_itbis_por_pagar_id ?? null,
    cuentaRetencionIsrId: fila?.cuenta_retencion_isr_id ?? null,
    cuentaRetencionItbisId: fila?.cuenta_retencion_itbis_id ?? null,
    cuentaCxcDefaultId: fila?.cuenta_cxc_default_id ?? null,
    cuentaCxpDefaultId: fila?.cuenta_cxp_default_id ?? null,
  };
}

export async function cargarReglasFiscales(
  empresaId: string,
): Promise<ReglaFiscalListado[]> {
  const supabase = await createClient();

  const filas = await paginarConsulta<ReglaFiscalFila>(async (desde, hasta) => {
    const { data, error } = await supabase
      .from("reglas_fiscales")
      .select("id, codigo, nombre, tipo, tasa_bps, cuenta_id, activa")
      .eq("empresa_id", empresaId)
      .order("codigo", { ascending: true })
      .range(desde, hasta);
    return { data: (data as ReglaFiscalFila[] | null) ?? null, error };
  });

  return filas.map((fila) => ({
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    tipo: fila.tipo,
    tasaBps: Number(fila.tasa_bps),
    cuentaId: fila.cuenta_id,
    activa: fila.activa,
  }));
}

export async function cargarObligaciones(
  empresaId: string,
): Promise<ObligacionFiscalListado[]> {
  const supabase = await createClient();

  const filas = await paginarConsulta<ObligacionFila>(async (desde, hasta) => {
    const { data, error } = await supabase
      .from("obligaciones_fiscales")
      .select(
        "id, codigo_formulario, periodo, fecha_limite, estado, monto_declarado, referencia_presentacion, presentado_en",
      )
      .eq("empresa_id", empresaId)
      .order("fecha_limite", { ascending: false })
      .order("id", { ascending: true })
      .range(desde, hasta);
    return { data: (data as ObligacionFila[] | null) ?? null, error };
  });

  return filas.map((fila) => ({
    id: fila.id,
    codigoFormulario: fila.codigo_formulario,
    periodo: fila.periodo,
    fechaLimite: fila.fecha_limite,
    estado:
      fila.estado === "filed" ||
      fila.estado === "paid" ||
      fila.estado === "overdue"
        ? fila.estado
        : "pending",
    montoDeclarado: Number(fila.monto_declarado),
    referenciaPresentacion: fila.referencia_presentacion,
    presentadoEn: fila.presentado_en,
  }));
}

export interface ReporteDgiiCargado {
  periodo: string;
  filas606: Fila606[];
  filas607: Fila607[];
}

/** Vista previa de los formatos 606/607 tal como los devuelve el motor SQL. */
export async function cargarReporteDgii(
  empresaId: string,
  periodo: string,
): Promise<ReporteDgiiCargado> {
  const supabase = await createClient();

  const [respuesta606, respuesta607] = await Promise.all([
    supabase.rpc("reporte_dgii_606", {
      p_empresa_id: empresaId,
      p_periodo: periodo,
    }),
    supabase.rpc("reporte_dgii_607", {
      p_empresa_id: empresaId,
      p_periodo: periodo,
    }),
  ]);

  if (respuesta606.error) throw new Error(respuesta606.error.message);
  if (respuesta607.error) throw new Error(respuesta607.error.message);

  return {
    periodo,
    filas606: (respuesta606.data ?? []) as Fila606[],
    filas607: (respuesta607.data ?? []) as Fila607[],
  };
}
