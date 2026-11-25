/** Tipos compartidos de los módulos de operaciones (gastos, facturación, cartera e impuestos). */

export type TipoDocumentoFinanciero =
  | "sales_invoice"
  | "purchase_invoice"
  | "sales_credit"
  | "purchase_credit";

export type TipoTercero = "customer" | "supplier" | "both";

export type EstadoDocumento = "draft" | "posted" | "void";

export type EstadoCobro = "saldada" | "pendiente" | "vencida";

export interface TerceroListado {
  id: string;
  tipo: TipoTercero;
  nombre: string;
  rnc: string;
  correo: string;
  telefono: string;
  direccion: string;
  activo: boolean;
  cuentaPorPagarId: string | null;
  cuentaPorCobrarId: string | null;
}

export interface CuentaOpcion {
  id: string;
  codigo: string;
  nombre: string;
  clasificacion: string;
}

export interface MetodoPagoOpcion {
  id: string;
  nombre: string;
  cuentaId: string;
  dejaCxpProveedor: boolean;
  activo: boolean;
}

export interface SecuenciaNcfListado {
  id: string;
  tipoComprobante: string;
  serie: "B" | "E";
  prefijo: string;
  numeroInicial: number;
  numeroFinal: number;
  numeroActual: number;
  fechaVencimiento: string | null;
  activo: boolean;
}

export interface DocumentoListado {
  id: string;
  tipo: TipoDocumentoFinanciero;
  numero: string;
  ncf: string;
  tipoNcf: string;
  terceroId: string;
  tercero: string;
  fechaEmision: string;
  fechaVencimiento: string | null;
  concepto: string;
  subtotal: number;
  impuesto: number;
  retenciones: number;
  total: number;
  pagado: number;
  saldo: number;
  estado: EstadoDocumento;
  estadoCobro: EstadoCobro;
  documentoAcreditadoId: string | null;
}

export interface PagoListado {
  id: string;
  documentoId: string;
  fechaPago: string;
  monto: number;
  metodoPago: string;
  cuentaId: string;
  cuenta: string;
  referencia: string;
  estado: "active" | "cancelled";
}

export interface DocumentoAcreditable {
  id: string;
  numero: string;
  ncf: string;
  tipo: TipoDocumentoFinanciero;
  terceroId: string;
  tercero: string;
  fechaEmision: string;
  total: number;
  saldo: number;
}

export interface SaldoAntiguedad {
  documentoId: string;
  numero: string;
  terceroId: string;
  tercero: string;
  fechaEmision: string;
  fechaVencimiento: string;
  diasVencido: number;
  saldo: number;
  bucket: string;
}

export interface ConfiguracionFiscalListado {
  tasaItbisBps: number;
  retencionIsrServiciosBps: number;
  retencionItbisServiciosBps: number;
  cuentaItbisAdelantadoId: string | null;
  cuentaItbisPorPagarId: string | null;
  cuentaRetencionIsrId: string | null;
  cuentaRetencionItbisId: string | null;
  cuentaCxcDefaultId: string | null;
  cuentaCxpDefaultId: string | null;
}

export interface ReglaFiscalListado {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  tasaBps: number;
  cuentaId: string | null;
  activa: boolean;
}

export interface ObligacionFiscalListado {
  id: string;
  codigoFormulario: string;
  periodo: string;
  fechaLimite: string;
  estado: "pending" | "filed" | "paid" | "overdue";
  montoDeclarado: number;
  referenciaPresentacion: string;
  presentadoEn: string | null;
}

export type ResultadoOperacion<T = undefined> =
  | { ok: true; mensaje: string; datos?: T }
  | { ok: false; error: string };

/** Datos que comparten la emisión de compras y la de ventas/notas de crédito. */
export interface EntradaDocumento {
  empresaId: string;
  tipo: TipoDocumentoFinanciero;
  terceroId: string;
  fechaEmision: string;
  fechaVencimiento: string | null;
  concepto: string;
  cuentaId: string;
  cuentaControlId: string;
  cuentaImpuestoId: string | null;
  cuentaRetencionId: string | null;
  subtotal: number;
  impuesto: number;
  retencionIsr: number;
  retencionItbis: number;
  /** Tipo de comprobante (`B01`–`B17`, `E31`–`E47`); vacío si no hay NCF. */
  tipoNcf: string;
  /** NCF manual del proveedor; vacío para consumir la secuencia de ventas. */
  ncf: string;
  documentoAcreditadoId: string | null;
}

export type ResultadoDescarga =
  | {
      ok: true;
      nombreArchivo: string;
      mime: string;
      contenidoBase64: string;
    }
  | { ok: false; error: string };

export interface ReporteDgiiResumen {
  periodo: string;
  incluidos606: number;
  excluidos606: number;
  incluidos607: number;
  excluidos607: number;
}

/** Comprobantes NCF de la DGII: serie B (B01–B17) y electrónica (E31–E47). */
export const TIPOS_COMPROBANTE_DGII = [
  "B01",
  "B02",
  "B03",
  "B04",
  "B05",
  "B06",
  "B07",
  "B08",
  "B09",
  "B10",
  "B11",
  "B12",
  "B13",
  "B14",
  "B15",
  "B16",
  "B17",
  "E31",
  "E32",
  "E33",
  "E34",
  "E35",
  "E36",
  "E37",
  "E38",
  "E39",
  "E40",
  "E41",
  "E42",
  "E43",
  "E44",
  "E45",
  "E46",
  "E47",
] as const;

/** Buckets del reporte de antigüedad de saldos. */
export const BUCKETS_ANTIGUEDAD = [
  { clave: "corriente", etiqueta: "Corriente" },
  { clave: "1_30", etiqueta: "1–30 días" },
  { clave: "31_60", etiqueta: "31–60 días" },
  { clave: "61_90", etiqueta: "61–90 días" },
  { clave: "mas_90", etiqueta: ">90 días" },
] as const;

export const ETIQUETAS_TIPO_DOCUMENTO: Record<TipoDocumentoFinanciero, string> =
  {
    sales_invoice: "Factura de venta",
    purchase_invoice: "Compra",
    sales_credit: "Nota de crédito de venta",
    purchase_credit: "Nota de crédito de compra",
  };

export const ETIQUETAS_ESTADO_OBLIGACION: Record<string, string> = {
  pending: "Pendiente",
  filed: "Presentada",
  paid: "Pagada",
  overdue: "Vencida",
};

export const FORMULARIOS_FISCALES = [
  { value: "606", label: "606 · Compras y gastos" },
  { value: "607", label: "607 · Ventas" },
  { value: "IT-1", label: "IT-1 · ITBIS" },
  { value: "IR-17", label: "IR-17 · Retenciones" },
  { value: "IR-3", label: "IR-3 · Renta anual" },
] as const;

/** Convierte un periodo `yyyy-MM` en `YYYYMM` (formato de las RPC de la DGII). */
export function periodoDgiiDesdeMes(periodo: string): string {
  return periodo.replace(/\D/g, "").slice(0, 6);
}

/** Convierte `YYYYMM` en `yyyy-MM` para `MonthPicker`. */
export function mesDesdePeriodoDgii(periodo: string): string {
  const limpio = periodo.replace(/\D/g, "");
  if (limpio.length !== 6) return "";
  return `${limpio.slice(0, 4)}-${limpio.slice(4)}`;
}
