"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

export type ResultadoBancos =
  | { ok: true; mensaje: string }
  | { ok: false; error: string };

export interface MovimientoConciliacion {
  id: string;
  fecha: string;
  descripcion: string;
  referencia: string;
  tipo: string;
  monto: number;
  conciliado: boolean;
  sesionId: string | null;
}

export type ResultadoMovimientosConciliacion =
  | { ok: true; movimientos: MovimientoConciliacion[] }
  | { ok: false; error: string };

export interface DatosCuentaBancaria {
  empresaId: string;
  id: string | null;
  nombre: string;
  banco: string;
  numeroCuenta: string;
  moneda: string;
  cuentaContableId: string;
  saldoInicial: number;
  activa: boolean;
}

export interface DatosMovimientoBancario {
  empresaId: string;
  cuentaBancariaId: string;
  fecha: string;
  tipo: string;
  monto: number;
  descripcion: string;
  referencia: string;
  cuentaContrapartidaId: string;
}

export interface FilaImportacionBancaria {
  fecha: string;
  descripcion: string;
  referencia: string;
  tipo: string;
  monto: number;
}

export interface DatosImportacionBancaria {
  empresaId: string;
  cuentaBancariaId: string;
  nombreArchivo: string;
  filas: FilaImportacionBancaria[];
}

export interface DatosSesionConciliacion {
  empresaId: string;
  cuentaBancariaId: string;
  fechaCorte: string;
  saldoExtracto: number;
  saldoLibros: number | null;
}

export interface DatosCierreConciliacion {
  empresaId: string;
  sesionId: string;
  fechaCierre: string;
}

const TIPOS_MOVIMIENTO = [
  "deposit",
  "withdrawal",
  "transfer",
  "fee",
  "interest",
] as const;

const identificador = z.string().uuid("Identificador inválido.");
const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener el formato aaaa-mm-dd.");
const texto = (max: number) =>
  z.string().trim().max(max, `Máximo ${max} caracteres.`);
const montoPositivo = z
  .number()
  .finite("Monto inválido.")
  .positive("El monto debe ser mayor a cero.");
const montoNoNegativo = z
  .number()
  .finite("Monto inválido.")
  .nonnegative("El monto no puede ser negativo.");

const esquemaCuenta = z.object({
  empresaId: identificador,
  id: identificador.nullable(),
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre de la cuenta es obligatorio.")
    .max(120, "Máximo 120 caracteres."),
  banco: texto(120),
  numeroCuenta: texto(60),
  moneda: z.enum(["DOP", "USD"]),
  cuentaContableId: identificador,
  saldoInicial: montoNoNegativo,
  activa: z.boolean(),
});

const esquemaMovimiento = z.object({
  empresaId: identificador,
  cuentaBancariaId: identificador,
  fecha,
  tipo: z.enum(TIPOS_MOVIMIENTO),
  monto: montoPositivo,
  descripcion: texto(240),
  referencia: texto(120),
  cuentaContrapartidaId: z.union([identificador, z.literal("")]),
});

const esquemaFilaImportacion = z.object({
  fecha,
  descripcion: texto(240),
  referencia: texto(120),
  tipo: z.enum(TIPOS_MOVIMIENTO),
  monto: montoPositivo,
});

const esquemaImportacion = z.object({
  empresaId: identificador,
  cuentaBancariaId: identificador,
  nombreArchivo: z
    .string()
    .trim()
    .min(1, "El nombre del archivo es obligatorio.")
    .max(200, "Máximo 200 caracteres."),
  filas: z
    .array(esquemaFilaImportacion)
    .min(1, "La importación requiere al menos una fila.")
    .max(2000, "La importación admite hasta 2.000 filas."),
});

const esquemaSesion = z.object({
  empresaId: identificador,
  cuentaBancariaId: identificador,
  fechaCorte: fecha,
  saldoExtracto: montoNoNegativo,
  saldoLibros: montoNoNegativo.nullable(),
});

const esquemaCierre = z.object({
  empresaId: identificador,
  sesionId: identificador,
  fechaCierre: fecha,
});

async function exigirSesion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return supabase;
}

function refrescar() {
  revalidatePath("/bancos");
}

function primerError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Revisa los datos enviados.";
}

export async function guardarCuentaBancariaAction(
  datos: DatosCuentaBancaria,
): Promise<ResultadoBancos> {
  const supabase = await exigirSesion();
  if (!supabase) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaCuenta.safeParse(datos);
  if (!resultado.success) {
    return { ok: false, error: primerError(resultado.error) };
  }

  const datosCuenta = resultado.data;
  const { error } = await supabase.rpc("guardar_cuenta_bancaria", {
    p_empresa_id: datosCuenta.empresaId,
    p_id: datosCuenta.id,
    p_nombre: datosCuenta.nombre,
    p_banco: datosCuenta.banco,
    p_numero_cuenta: datosCuenta.numeroCuenta,
    p_moneda: datosCuenta.moneda,
    p_cuenta_contable_id: datosCuenta.cuentaContableId,
    p_saldo_inicial: datosCuenta.saldoInicial,
    p_activa: datosCuenta.activa,
  });

  if (error) return { ok: false, error: error.message };

  refrescar();

  return {
    ok: true,
    mensaje:
      datosCuenta.id === null
        ? "Cuenta bancaria creada correctamente."
        : "Cuenta bancaria actualizada correctamente.",
  };
}

export async function registrarMovimientoBancarioAction(
  datos: DatosMovimientoBancario,
): Promise<ResultadoBancos> {
  const supabase = await exigirSesion();
  if (!supabase) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaMovimiento.safeParse(datos);
  if (!resultado.success) {
    return { ok: false, error: primerError(resultado.error) };
  }

  const movimiento = resultado.data;
  const { error } = await supabase.rpc("registrar_movimiento_bancario", {
    p_empresa_id: movimiento.empresaId,
    p_cuenta_bancaria_id: movimiento.cuentaBancariaId,
    p_fecha: movimiento.fecha,
    p_tipo: movimiento.tipo,
    p_monto: movimiento.monto,
    p_descripcion: movimiento.descripcion,
    p_referencia: movimiento.referencia,
    p_cuenta_contrapartida_id:
      movimiento.cuentaContrapartidaId === ""
        ? null
        : movimiento.cuentaContrapartidaId,
  });

  if (error) return { ok: false, error: error.message };

  refrescar();

  return { ok: true, mensaje: "Movimiento bancario registrado." };
}

export async function importarMovimientosBancariosAction(
  datos: DatosImportacionBancaria,
): Promise<ResultadoBancos> {
  const supabase = await exigirSesion();
  if (!supabase) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaImportacion.safeParse(datos);
  if (!resultado.success) {
    return { ok: false, error: primerError(resultado.error) };
  }

  const importacion = resultado.data;
  const filas: Json = importacion.filas.map((fila) => ({
    fecha: fila.fecha,
    descripcion: fila.descripcion,
    referencia: fila.referencia,
    tipo: fila.tipo,
    monto: fila.monto,
  }));

  const { error } = await supabase.rpc("importar_movimientos_bancarios", {
    p_empresa_id: importacion.empresaId,
    p_cuenta_bancaria_id: importacion.cuentaBancariaId,
    p_nombre_archivo: importacion.nombreArchivo,
    p_filas: filas,
  });

  if (error) return { ok: false, error: error.message };

  refrescar();

  return {
    ok: true,
    mensaje: `Extracto importado: ${importacion.filas.length} movimientos.`,
  };
}

export async function crearSesionConciliacionAction(
  datos: DatosSesionConciliacion,
): Promise<ResultadoBancos> {
  const supabase = await exigirSesion();
  if (!supabase) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaSesion.safeParse(datos);
  if (!resultado.success) {
    return { ok: false, error: primerError(resultado.error) };
  }

  const sesion = resultado.data;
  const { error } = await supabase.rpc("crear_sesion_conciliacion", {
    p_empresa_id: sesion.empresaId,
    p_cuenta_bancaria_id: sesion.cuentaBancariaId,
    p_fecha_corte: sesion.fechaCorte,
    p_saldo_extracto: sesion.saldoExtracto,
    p_saldo_libros: sesion.saldoLibros,
  });

  if (error) return { ok: false, error: error.message };

  refrescar();

  return { ok: true, mensaje: "Sesión de conciliación creada." };
}

export async function marcarMovimientoConciliadoAction(datos: {
  empresaId: string;
  movimientoId: string;
  sesionId: string;
  conciliado: boolean;
}): Promise<ResultadoBancos> {
  const supabase = await exigirSesion();
  if (!supabase) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = z
    .object({
      empresaId: identificador,
      movimientoId: identificador,
      sesionId: identificador,
      conciliado: z.boolean(),
    })
    .safeParse(datos);

  if (!resultado.success) {
    return { ok: false, error: primerError(resultado.error) };
  }

  const { error } = await supabase.rpc("marcar_movimiento_conciliado", {
    p_empresa_id: resultado.data.empresaId,
    p_movimiento_id: resultado.data.movimientoId,
    p_sesion_id: resultado.data.sesionId,
    p_conciliado: resultado.data.conciliado,
  });

  if (error) return { ok: false, error: error.message };

  refrescar();

  return {
    ok: true,
    mensaje: resultado.data.conciliado
      ? "Movimiento marcado como conciliado."
      : "Movimiento desmarcado.",
  };
}

export async function cerrarSesionConciliacionAction(
  datos: DatosCierreConciliacion,
): Promise<ResultadoBancos> {
  const supabase = await exigirSesion();
  if (!supabase) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaCierre.safeParse(datos);
  if (!resultado.success) {
    return { ok: false, error: primerError(resultado.error) };
  }

  const { error } = await supabase.rpc("cerrar_sesion_conciliacion", {
    p_empresa_id: resultado.data.empresaId,
    p_sesion_id: resultado.data.sesionId,
    p_fecha_cierre: resultado.data.fechaCierre,
  });

  if (error) return { ok: false, error: error.message };

  refrescar();

  return { ok: true, mensaje: "Sesión de conciliación cerrada." };
}

interface MovimientoFila {
  id: string;
  fecha: string;
  descripcion: string;
  referencia: string;
  tipo: string;
  monto: number;
  conciliado: boolean;
  sesion_conciliacion_id: string | null;
}

/** Movimientos de una cuenta para el panel de conciliación. */
export async function listarMovimientosConciliacionAction(
  cuentaBancariaId: string,
): Promise<ResultadoMovimientosConciliacion> {
  const supabase = await exigirSesion();
  if (!supabase) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const identificadorCuenta = identificador.safeParse(cuentaBancariaId);
  if (!identificadorCuenta.success) {
    return { ok: false, error: "Cuenta bancaria inválida." };
  }

  const filas = await paginarConsulta<MovimientoFila>(async (desde, hasta) => {
    const { data, error } = await supabase
      .from("movimientos_bancarios")
      .select(
        "id, fecha, descripcion, referencia, tipo, monto, conciliado, sesion_conciliacion_id",
      )
      .eq("cuenta_bancaria_id", identificadorCuenta.data)
      .order("fecha", { ascending: true })
      .order("id", { ascending: true })
      .range(desde, hasta);
    return { data: (data as MovimientoFila[] | null) ?? null, error };
  });

  return {
    ok: true,
    movimientos: filas.map((fila) => ({
      id: fila.id,
      fecha: fila.fecha,
      descripcion: fila.descripcion,
      referencia: fila.referencia,
      tipo: fila.tipo,
      monto: Number(fila.monto),
      conciliado: fila.conciliado,
      sesionId: fila.sesion_conciliacion_id,
    })),
  };
}
