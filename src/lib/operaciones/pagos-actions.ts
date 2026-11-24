"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ResultadoOperacion } from "@/lib/operaciones/tipos";
import { createClient } from "@/lib/supabase/server";

const RUTAS_CARTERA = [
  "/gastos",
  "/facturacion",
  "/cuentas-por-cobrar",
  "/cuentas-por-pagar",
  "/impuestos",
  "/dashboard",
];

function refrescarCartera() {
  for (const ruta of RUTAS_CARTERA) {
    revalidatePath(ruta);
  }
}

const identificador = z.string().uuid("Identificador inválido.");
const fecha = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.");

const esquemaPago = z.object({
  empresaId: identificador,
  documentoId: identificador,
  fechaPago: fecha,
  monto: z.coerce.number().positive("El monto del pago debe ser mayor a cero."),
  metodoPago: z
    .string()
    .trim()
    .min(1, "Indica el método de pago.")
    .max(80, "Máximo 80 caracteres."),
  cuentaId: identificador,
  referencia: z.string().trim().max(120, "Máximo 120 caracteres.").optional(),
});

const esquemaAnulacionPago = z.object({
  empresaId: identificador,
  pagoId: identificador,
  fechaAnulacion: fecha,
  motivo: z
    .string()
    .trim()
    .min(3, "El motivo debe tener al menos 3 caracteres.")
    .max(200, "Máximo 200 caracteres."),
});

const esquemaAnulacionDocumento = z.object({
  empresaId: identificador,
  documentoId: identificador,
  fechaAnulacion: fecha,
  motivo: z
    .string()
    .trim()
    .min(3, "El motivo debe tener al menos 3 caracteres.")
    .max(200, "Máximo 200 caracteres."),
});

async function exigirSesion(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user !== null;
}

export interface EntradaRegistrarPago {
  empresaId: string;
  documentoId: string;
  fechaPago: string;
  monto: number;
  metodoPago: string;
  cuentaId: string;
  referencia?: string;
}

/** Registra un cobro (CxC) o un pago (CxP) con su asiento contable. */
export async function registrarPagoDocumentoAction(
  entrada: EntradaRegistrarPago,
): Promise<ResultadoOperacion> {
  if (!(await exigirSesion())) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaPago.safeParse(entrada);
  if (!resultado.success) {
    return {
      ok: false,
      error: resultado.error.issues[0]?.message ?? "Revisa los datos del pago.",
    };
  }

  const datos = resultado.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc("registrar_pago_documento", {
    p_empresa_id: datos.empresaId,
    p_documento_id: datos.documentoId,
    p_fecha_pago: datos.fechaPago,
    p_monto: datos.monto,
    p_metodo_pago: datos.metodoPago,
    p_cuenta_id: datos.cuentaId,
    p_referencia: datos.referencia ?? "",
  });

  if (error) return { ok: false, error: error.message };

  refrescarCartera();
  return { ok: true, mensaje: "Pago registrado y contabilizado." };
}

/** Anula un pago con asiento de reverso (nunca se borra). */
export async function anularPagoDocumentoAction(entrada: {
  empresaId: string;
  pagoId: string;
  fechaAnulacion: string;
  motivo: string;
}): Promise<ResultadoOperacion> {
  if (!(await exigirSesion())) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaAnulacionPago.safeParse(entrada);
  if (!resultado.success) {
    return {
      ok: false,
      error:
        resultado.error.issues[0]?.message ??
        "Revisa los datos de la anulación.",
    };
  }

  const datos = resultado.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc("anular_pago_documento", {
    p_empresa_id: datos.empresaId,
    p_pago_id: datos.pagoId,
    p_fecha_anulacion: datos.fechaAnulacion,
    p_motivo: datos.motivo,
  });

  if (error) return { ok: false, error: error.message };

  refrescarCartera();
  return { ok: true, mensaje: "Pago anulado con su asiento de reverso." };
}

/** Anula un documento financiero: exige anular antes sus pagos y notas. */
export async function anularDocumentoAction(entrada: {
  empresaId: string;
  documentoId: string;
  fechaAnulacion: string;
  motivo: string;
}): Promise<ResultadoOperacion> {
  if (!(await exigirSesion())) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaAnulacionDocumento.safeParse(entrada);
  if (!resultado.success) {
    return {
      ok: false,
      error:
        resultado.error.issues[0]?.message ??
        "Revisa los datos de la anulación.",
    };
  }

  const datos = resultado.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc("anular_documento", {
    p_empresa_id: datos.empresaId,
    p_documento_id: datos.documentoId,
    p_fecha_anulacion: datos.fechaAnulacion,
    p_motivo: datos.motivo,
  });

  if (error) return { ok: false, error: error.message };

  refrescarCartera();
  return {
    ok: true,
    mensaje:
      "Documento anulado por reverso. Los asientos originales se conservan.",
  };
}
