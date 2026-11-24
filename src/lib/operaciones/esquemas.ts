import { z } from "zod";

/**
 * Esquemas de validación de las acciones de servidor de operaciones.
 * Solo se importan desde archivos `"use server"`: nunca llegan al cliente.
 */

export const identificador = z.string().uuid("Identificador inválido.");

export const fecha = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.");

export const fechaOpcional = z
  .union([fecha, z.literal(""), z.null()])
  .optional()
  .transform((valor) => (valor === "" || valor == null ? null : valor));

export const monto = z.coerce
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

const cuentaOpcional = z
  .union([identificador, z.literal(""), z.null()])
  .optional()
  .transform((valor) => (valor === "" || valor == null ? null : valor));

export const esquemaDocumento = z.object({
  empresaId: identificador,
  tipo: z.enum([
    "sales_invoice",
    "purchase_invoice",
    "sales_credit",
    "purchase_credit",
  ]),
  terceroId: identificador,
  fechaEmision: fecha,
  fechaVencimiento: fechaOpcional,
  concepto: z
    .string()
    .trim()
    .min(1, "El concepto del documento es obligatorio.")
    .max(300, "Máximo 300 caracteres."),
  cuentaId: identificador,
  cuentaControlId: identificador,
  cuentaImpuestoId: cuentaOpcional,
  cuentaRetencionId: cuentaOpcional,
  subtotal: z.coerce.number().positive("El subtotal debe ser mayor a cero."),
  impuesto: monto,
  retencionIsr: monto,
  retencionItbis: monto,
  tipoNcf,
  ncf: ncfManual,
  documentoAcreditadoId: cuentaOpcional,
});

export type DocumentoValidado = z.infer<typeof esquemaDocumento>;

const archivoBase64 = z
  .string()
  .min(1, "Selecciona un archivo Excel o CSV.")
  .max(20_000_000, "El archivo supera el límite de 20 MB.");

const nombreArchivo = z
  .string()
  .trim()
  .min(1, "Falta el nombre del archivo.")
  .max(200, "Nombre de archivo demasiado largo.")
  .refine(
    (valor) => /\.(xlsx|csv)$/i.test(valor),
    "Solo se aceptan archivos .xlsx o .csv.",
  );

export const esquemaLote = z.object({
  empresaId: identificador,
  nombreArchivo,
  archivoBase64,
  cuentaId: identificador,
  cuentaControlId: identificador,
  cuentaImpuestoId: cuentaOpcional,
});

export const esquemaConfiguracionFiscal = z.object({
  empresaId: identificador,
  tasaItbisBps: z.coerce
    .number()
    .int("La tasa debe ser un entero en puntos base.")
    .min(0)
    .max(10_000),
  retencionIsrServiciosBps: z.coerce.number().int().min(0).max(10_000),
  retencionItbisServiciosBps: z.coerce.number().int().min(0).max(10_000),
  cuentaItbisAdelantadoId: cuentaOpcional,
  cuentaItbisPorPagarId: cuentaOpcional,
  cuentaRetencionIsrId: cuentaOpcional,
  cuentaRetencionItbisId: cuentaOpcional,
  cuentaCxcDefaultId: cuentaOpcional,
  cuentaCxpDefaultId: cuentaOpcional,
});

export const esquemaSecuenciaNcf = z.object({
  empresaId: identificador,
  id: identificador.optional().nullable(),
  tipoComprobante: z
    .string()
    .trim()
    .transform((valor) => valor.toUpperCase())
    .refine(
      (valor) => PATRON_TIPO_NCF.test(valor),
      "Tipo de comprobante inválido (use B01–B17 o E31–E47).",
    ),
  prefijo: z
    .string()
    .trim()
    .transform((valor) => valor.toUpperCase())
    .refine(
      (valor) => /^[A-Z0-9]{3,6}$/.test(valor),
      "El prefijo debe tener entre 3 y 6 caracteres alfanuméricos.",
    ),
  numeroInicial: z.coerce
    .number()
    .int()
    .min(1, "El número inicial debe ser 1 o más."),
  numeroFinal: z.coerce
    .number()
    .int()
    .min(1, "El número final debe ser 1 o más."),
  fechaVencimiento: fechaOpcional,
  activo: z.boolean().optional(),
});

export const esquemaReglaFiscal = z.object({
  empresaId: identificador,
  id: identificador.optional().nullable(),
  codigo: z
    .string()
    .trim()
    .min(1, "El código es obligatorio.")
    .max(20, "Máximo 20 caracteres."),
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio.")
    .max(120, "Máximo 120 caracteres."),
  tipo: z.enum(["itbis", "isr", "retencion_itbis", "retencion_isr", "otro"]),
  tasaBps: z.coerce
    .number()
    .int("La tasa debe ser un entero en puntos base.")
    .min(0)
    .max(10_000),
  cuentaId: cuentaOpcional,
  activa: z.boolean().optional(),
});

export const esquemaMetodoPago = z.object({
  empresaId: identificador,
  id: identificador.optional().nullable(),
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre del método es obligatorio.")
    .max(80, "Máximo 80 caracteres."),
  cuentaId: identificador,
  dejaCxpProveedor: z.boolean().optional(),
  activo: z.boolean().optional(),
});

export const esquemaObligacionFiscal = z.object({
  empresaId: identificador,
  id: identificador.optional().nullable(),
  codigoFormulario: z
    .string()
    .trim()
    .transform((valor) => valor.toUpperCase())
    .refine(
      (valor) => /^(606|607|IT-1|IR-17|IR-3)$/.test(valor),
      "Formulario inválido.",
    ),
  periodo: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "El periodo debe ser AAAAMM.")
    .refine(
      (valor) =>
        Number(valor.slice(4, 6)) >= 1 && Number(valor.slice(4, 6)) <= 12,
      "El mes del periodo no es válido.",
    ),
  fechaLimite: fecha,
  estado: z.enum(["pending", "filed", "paid", "overdue"]).optional(),
  montoDeclarado: monto.optional(),
  referenciaPresentacion: z.string().trim().max(120).optional(),
});
