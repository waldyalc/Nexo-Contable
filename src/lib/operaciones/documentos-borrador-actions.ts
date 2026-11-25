"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ResultadoOperacion } from "@/lib/operaciones/tipos";
import { createClient } from "@/lib/supabase/server";

const RUTAS_DOCUMENTOS = [
  "/gastos",
  "/facturacion",
  "/cuentas-por-cobrar",
  "/cuentas-por-pagar",
  "/impuestos",
  "/inventario",
  "/dashboard",
];

const identificador = z.string().uuid("Identificador inválido.");
const fecha = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.");
const fechaOpcional = z
  .union([fecha, z.literal(""), z.null()])
  .optional()
  .transform((valor) => (valor === "" || valor == null ? null : valor));
const cuentaOpcional = z
  .union([identificador, z.literal(""), z.null()])
  .optional()
  .transform((valor) => (valor === "" || valor == null ? null : valor));
const monto = z.coerce
  .number()
  .finite("Monto inválido.")
  .min(0, "El monto no puede ser negativo.");

const PATRON_TIPO_NCF = /^(B(0[1-9]|1[0-7])|E(3[1-9]|4[0-7]))$/;
const PATRON_NCF = /^(B(0[1-9]|1[0-7])[0-9]{8}|E(3[1-9]|4[0-7])[0-9]{10})$/;

const tipoNcf = z
  .string()
  .trim()
  .transform((valor) => valor.toUpperCase())
  .refine(
    (valor) => valor === "" || PATRON_TIPO_NCF.test(valor),
    "Tipo de comprobante NCF inválido (use B01–B17 o E31–E47).",
  );

const ncfManual = z
  .string()
  .trim()
  .transform((valor) => valor.toUpperCase())
  .refine(
    (valor) => valor === "" || PATRON_NCF.test(valor),
    "El NCF no tiene un formato válido de la DGII.",
  );

const esquemaRenglon = z.object({
  cuentaId: cuentaOpcional,
  monto,
  descripcion: z.string().trim().max(200).optional(),
  articuloId: cuentaOpcional,
  cantidad: z.coerce.number().positive().nullable(),
  precioUnitario: z.coerce.number().min(0).nullable(),
  costoUnitario: z.coerce.number().min(0).nullable(),
});

const esquemaBorrador = z.object({
  empresaId: identificador,
  documentoId: cuentaOpcional,
  tipo: z.enum([
    "sales_invoice",
    "purchase_invoice",
    "sales_credit",
    "purchase_credit",
  ]),
  numero: z
    .string()
    .trim()
    .min(1, "El número interno es obligatorio.")
    .max(40, "Máximo 40 caracteres."),
  terceroId: identificador,
  fechaEmision: fecha,
  fechaVencimiento: fecha,
  concepto: z
    .string()
    .trim()
    .min(1, "El concepto del documento es obligatorio.")
    .max(500, "Máximo 500 caracteres."),
  cuentaId: cuentaOpcional,
  cuentaControlId: cuentaOpcional,
  cuentaImpuestoId: cuentaOpcional,
  cuentaRetencionId: cuentaOpcional,
  subtotal: monto,
  impuesto: monto,
  retenciones: monto,
  retencionIsr: monto,
  retencionItbis: monto,
  otrosImpuestos: monto,
  tipoNcf,
  ncf: ncfManual,
  documentoAcreditadoId: cuentaOpcional,
  proforma: z.boolean(),
  tipoGasto: z.string().trim().max(4).optional(),
  tipoRetencionIsr: z.string().trim().max(1).optional(),
  fechaPagoRetenciones: fechaOpcional,
  metodoPagoId: cuentaOpcional,
  lineas: z.array(esquemaRenglon).max(200),
});

export type EntradaDocumentoBorrador = z.input<typeof esquemaBorrador>;

function refrescarDocumentos() {
  for (const ruta of RUTAS_DOCUMENTOS) revalidatePath(ruta);
}

async function exigirSesion(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user !== null;
}

function primerError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Revisa los datos del documento.";
}

/** Guarda o edita un borrador sin generar asiento contable. */
export async function guardarDocumentoBorradorAction(
  entrada: EntradaDocumentoBorrador,
): Promise<ResultadoOperacion<{ id: string }>> {
  if (!(await exigirSesion())) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaBorrador.safeParse(entrada);
  if (!resultado.success) {
    return { ok: false, error: primerError(resultado.error) };
  }

  const datos = resultado.data;
  const detalles: Record<string, string | number | boolean | null> = {};

  if (datos.tipoGasto) detalles.goods_services_type = datos.tipoGasto;
  if (datos.retencionIsr > 0) {
    detalles.income_tax_withheld = datos.retencionIsr;
    if (datos.tipoRetencionIsr) {
      detalles.isr_retention_type = datos.tipoRetencionIsr;
    }
  }
  if (datos.retencionItbis > 0) {
    detalles.itbis_withheld = datos.retencionItbis;
  }
  if (datos.fechaPagoRetenciones) {
    detalles.payment_date = datos.fechaPagoRetenciones;
  }
  if (datos.metodoPagoId) detalles.payment_method_id = datos.metodoPagoId;

  const lineas = datos.lineas.map((linea) => ({
    account_id: linea.cuentaId,
    amount: linea.monto,
    description: linea.descripcion ?? "",
    item_id: linea.articuloId,
    quantity: linea.cantidad,
    unit_price: linea.precioUnitario,
    unit_cost: linea.costoUnitario,
  }));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("guardar_documento_borrador", {
    p_empresa_id: datos.empresaId,
    p_tipo: datos.tipo,
    p_tercero_id: datos.terceroId,
    p_fecha_emision: datos.fechaEmision,
    p_concepto: datos.concepto,
    p_cuenta_id: datos.cuentaId,
    p_cuenta_control_id: datos.cuentaControlId,
    p_subtotal: datos.subtotal,
    p_impuesto: datos.impuesto,
    p_retenciones: datos.retenciones,
    p_otros_impuestos: datos.otrosImpuestos,
    p_numero: datos.numero,
    p_tipo_ncf: datos.tipoNcf,
    p_ncf: datos.ncf,
    p_fecha_vencimiento: datos.fechaVencimiento,
    p_cuenta_impuesto_id: datos.cuentaImpuestoId,
    p_cuenta_retencion_id: datos.cuentaRetencionId,
    p_documento_acreditado_id: datos.documentoAcreditadoId,
    p_detalles_fiscales: detalles,
    p_retencion_isr: datos.retencionIsr > 0 ? datos.retencionIsr : null,
    p_retencion_itbis: datos.retencionItbis > 0 ? datos.retencionItbis : null,
    p_documento_id: datos.documentoId,
    p_proforma: datos.proforma,
    p_lineas: lineas,
  });

  if (error) return { ok: false, error: error.message };
  if (typeof data !== "string") {
    return { ok: false, error: "No pudimos confirmar el borrador guardado." };
  }

  refrescarDocumentos();
  return {
    ok: true,
    mensaje:
      datos.documentoId === null
        ? "Borrador guardado."
        : "Borrador actualizado.",
    datos: { id: data },
  };
}

/** Contabiliza un borrador ya guardado; el asiento se crea en SQL. */
export async function contabilizarDocumentoBorradorAction(entrada: {
  empresaId: string;
  documentoId: string;
}): Promise<ResultadoOperacion<{ id: string }>> {
  if (!(await exigirSesion())) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const empresaId = identificador.safeParse(entrada.empresaId);
  const documentoId = identificador.safeParse(entrada.documentoId);
  if (!empresaId.success || !documentoId.success) {
    return { ok: false, error: "Identificador de documento inválido." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "contabilizar_documento_financiero",
    {
      p_empresa_id: empresaId.data,
      p_documento_id: documentoId.data,
    },
  );

  if (error) return { ok: false, error: error.message };
  if (typeof data !== "string") {
    return { ok: false, error: "No pudimos confirmar la contabilización." };
  }

  refrescarDocumentos();
  return {
    ok: true,
    mensaje: "Documento contabilizado correctamente.",
    datos: { id: data },
  };
}

/** Asigna el próximo NCF de la secuencia a una factura proforma. */
export async function asignarNcfDocumentoBorradorAction(entrada: {
  empresaId: string;
  documentoId: string;
  tipoComprobante: string;
}): Promise<ResultadoOperacion<{ id: string }>> {
  if (!(await exigirSesion())) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const empresaId = identificador.safeParse(entrada.empresaId);
  const documentoId = identificador.safeParse(entrada.documentoId);
  const tipo = tipoNcf.safeParse(entrada.tipoComprobante);
  if (
    !empresaId.success ||
    !documentoId.success ||
    !tipo.success ||
    tipo.data === ""
  ) {
    return { ok: false, error: "Selecciona un comprobante válido." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("asignar_ncf_documento_borrador", {
    p_empresa_id: empresaId.data,
    p_documento_id: documentoId.data,
    p_tipo_comprobante: tipo.data,
  });

  if (error) return { ok: false, error: error.message };
  if (typeof data !== "string") {
    return {
      ok: false,
      error: "No pudimos confirmar el comprobante asignado.",
    };
  }

  refrescarDocumentos();
  return {
    ok: true,
    mensaje: "Comprobante asignado a la factura proforma.",
    datos: { id: data },
  };
}
