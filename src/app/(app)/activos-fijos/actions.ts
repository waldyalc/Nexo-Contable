"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type ResultadoActivos =
  | { ok: true; mensaje: string }
  | { ok: false; error: string };

export interface DatosActivoFijo {
  empresaId: string;
  id: string | null;
  codigo: string;
  nombre: string;
  categoria: string;
  fechaAdquisicion: string;
  /** `null` al editar un activo ya depreciado: el RPC no admite cambios de base. */
  costoAdquisicion: number | null;
  valorResidual: number | null;
  vidaUtilMeses: number | null;
  cuentaActivoId: string;
  cuentaDepreciacionAcumuladaId: string;
  cuentaGastoDepreciacionId: string;
}

export interface DatosDepreciacion {
  empresaId: string;
  /** Periodo en formato `aaaa-mm`. */
  periodo: string;
  fecha: string;
}

const identificador = z.string().uuid("Identificador inválido.");
const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener el formato aaaa-mm-dd.");
const texto = (max: number) =>
  z.string().trim().max(max, `Máximo ${max} caracteres.`);
const montoNoNegativo = z
  .number()
  .finite("Monto inválido.")
  .nonnegative("El monto no puede ser negativo.");

const esquemaActivo = z.object({
  empresaId: identificador,
  id: identificador.nullable(),
  codigo: z
    .string()
    .trim()
    .min(1, "El código del activo es obligatorio.")
    .max(40, "Máximo 40 caracteres."),
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre del activo es obligatorio.")
    .max(160, "Máximo 160 caracteres."),
  categoria: texto(80),
  fechaAdquisicion: fecha,
  costoAdquisicion: montoNoNegativo.nullable(),
  valorResidual: montoNoNegativo.nullable(),
  vidaUtilMeses: z
    .number()
    .int("La vida útil debe ser un número entero de meses.")
    .positive("La vida útil debe ser mayor a cero.")
    .nullable(),
  cuentaActivoId: identificador,
  cuentaDepreciacionAcumuladaId: identificador,
  cuentaGastoDepreciacionId: identificador,
});

const esquemaDepreciacion = z.object({
  empresaId: identificador,
  periodo: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Selecciona el periodo a depreciar."),
  fecha,
});

async function exigirSesion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return supabase;
}

function primerError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Revisa los datos enviados.";
}

export async function guardarActivoFijoAction(
  datos: DatosActivoFijo,
): Promise<ResultadoActivos> {
  const supabase = await exigirSesion();
  if (!supabase) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaActivo.safeParse(datos);
  if (!resultado.success) {
    return { ok: false, error: primerError(resultado.error) };
  }

  const activo = resultado.data;

  if (
    activo.id === null &&
    (activo.costoAdquisicion === null ||
      activo.valorResidual === null ||
      activo.vidaUtilMeses === null)
  ) {
    return {
      ok: false,
      error: "Completa el costo, el valor residual y la vida útil del activo.",
    };
  }

  if (
    activo.costoAdquisicion !== null &&
    activo.valorResidual !== null &&
    activo.valorResidual > activo.costoAdquisicion
  ) {
    return {
      ok: false,
      error: "El valor residual no puede exceder el costo de adquisición.",
    };
  }

  const { error } = await supabase.rpc("guardar_activo_fijo", {
    p_empresa_id: activo.empresaId,
    p_id: activo.id,
    p_codigo: activo.codigo,
    p_nombre: activo.nombre,
    p_categoria: activo.categoria,
    p_fecha_adquisicion: activo.fechaAdquisicion,
    p_costo_adquisicion: activo.costoAdquisicion,
    p_valor_residual: activo.valorResidual,
    p_vida_util_meses: activo.vidaUtilMeses,
    p_cuenta_activo_id: activo.cuentaActivoId,
    p_cuenta_depreciacion_acumulada_id: activo.cuentaDepreciacionAcumuladaId,
    p_cuenta_gasto_depreciacion_id: activo.cuentaGastoDepreciacionId,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/activos-fijos");

  return {
    ok: true,
    mensaje:
      activo.id === null
        ? "Activo fijo creado correctamente."
        : "Activo fijo actualizado correctamente.",
  };
}

export async function correrDepreciacionAction(
  datos: DatosDepreciacion,
): Promise<ResultadoActivos> {
  const supabase = await exigirSesion();
  if (!supabase) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaDepreciacion.safeParse(datos);
  if (!resultado.success) {
    return { ok: false, error: primerError(resultado.error) };
  }

  const depreciacion = resultado.data;
  const periodo = depreciacion.periodo.replace("-", "");

  const { data, error } = await supabase.rpc("correr_depreciacion_periodo", {
    p_empresa_id: depreciacion.empresaId,
    p_periodo: periodo,
    p_fecha: depreciacion.fecha,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/activos-fijos");

  const depreciados = typeof data === "number" ? data : 0;

  return {
    ok: true,
    mensaje:
      depreciados === 0
        ? "No quedaron activos pendientes de depreciar en el periodo."
        : `${depreciados} activos depreciados en el periodo.`,
  };
}
