"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { obtenerContextoApp } from "@/lib/auth/sesion";
import { type Moneda, aNumero } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type ResultadoReporte<T> =
  | { ok: true; filas: T[]; resultado: number }
  | { ok: false; error: string };

export type ResultadoConsulta<T> =
  | { ok: true; filas: T[] }
  | { ok: false; error: string };

export type ResultadoExportacion =
  | { ok: true; archivo: string; base64: string }
  | { ok: false; error: string };

export interface FilaEstadoResultados {
  clasificacion: string;
  cuentaId: string;
  codigo: string;
  nombre: string;
  debitos: number;
  creditos: number;
  monto: number;
}

export interface FilaBalanceGeneral {
  clasificacion: string;
  cuentaId: string;
  codigo: string;
  nombre: string;
  monto: number;
}

export interface FilaFlujoEfectivo {
  categoria: string;
  monto: number;
}

export interface CuentaContable {
  id: string;
  codigo: string;
  nombre: string;
  padreId: string | null;
  clasificacion: string;
  naturaleza: string;
  nivel: number;
  esAgrupacion: boolean;
  activa: boolean;
  esEquivalenteEfectivo: boolean;
  categoriaFlujoEfectivo: string;
}

export interface FilaBalanza {
  cuentaId: string;
  codigo: string;
  nombre: string;
  clasificacion: string;
  naturaleza: string;
  saldoAnterior: number;
  debitos: number;
  creditos: number;
  saldoActual: number;
}

export interface FilaMayor {
  fecha: string;
  asientoId: string;
  asientoNumero: string;
  referencia: string;
  descripcion: string;
  debito: number;
  credito: number;
  saldo: number;
}

export interface FilaCambiosPatrimonio {
  tipoFila: string;
  cuentaId: string | null;
  codigo: string;
  nombre: string;
  saldoInicial: number;
  debitos: number;
  creditos: number;
  movimientoNeto: number;
  saldoFinal: number;
}

interface ContextoAccion {
  supabase: SupabaseClient<Database>;
  empresaId: string;
  empresaNombre: string;
  moneda: Moneda;
}

type ResultadoContexto =
  | { ok: true; contexto: ContextoAccion }
  | { ok: false; error: string };

const ROLES_FINANZAS = new Set(["admin_global", "admin_empresa", "contador"]);

const fechaIso = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.");

const esquemaRango = z.object({ desde: fechaIso, hasta: fechaIso });
const esquemaCorte = z.object({ fechaCorte: fechaIso });
const esquemaMayor = esquemaRango.extend({
  cuentaId: z.string().uuid("Cuenta inválida."),
});

async function prepararAccion(): Promise<ResultadoContexto> {
  const contexto = await obtenerContextoApp();
  const empresa = contexto.empresaActiva;

  if (!empresa) {
    return {
      ok: false,
      error: "Selecciona una empresa para consultar los estados financieros.",
    };
  }

  const rol = contexto.esAdminGlobal ? "admin_global" : empresa.rol;

  if (!ROLES_FINANZAS.has(rol)) {
    return {
      ok: false,
      error: "Tu rol no tiene acceso al módulo de finanzas.",
    };
  }

  const supabase = await createClient();

  return {
    ok: true,
    contexto: {
      supabase,
      empresaId: empresa.id,
      empresaNombre: empresa.nombreComercial,
      moneda: empresa.monedaFuncional === "USD" ? "USD" : "DOP",
    },
  };
}

function errorDeExcepcion(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Ocurrió un error inesperado.";
}

function calcularResultado(filas: readonly FilaEstadoResultados[]): number {
  return filas.reduce((acumulado, fila) => {
    if (fila.clasificacion === "income") return acumulado + fila.monto;
    if (fila.clasificacion === "cost") return acumulado - fila.monto;
    if (fila.clasificacion === "expense") return acumulado - fila.monto;
    return acumulado;
  }, 0);
}

async function consultarEstadoResultados(
  contexto: ContextoAccion,
  desde: string,
  hasta: string,
): Promise<ResultadoReporte<FilaEstadoResultados>> {
  const { data, error } = await contexto.supabase.rpc(
    "reporte_estado_resultados",
    {
      p_empresa_id: contexto.empresaId,
      p_desde: desde,
      p_hasta: hasta,
    },
  );

  if (error) return { ok: false, error: error.message };

  const filas: FilaEstadoResultados[] = (data ?? []).map((fila) => ({
    clasificacion: fila.clasificacion,
    cuentaId: fila.cuenta_id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    debitos: aNumero(fila.debitos),
    creditos: aNumero(fila.creditos),
    monto: aNumero(fila.monto),
  }));

  return { ok: true, filas, resultado: calcularResultado(filas) };
}

async function consultarBalanceGeneral(
  contexto: ContextoAccion,
  fechaCorte: string,
): Promise<ResultadoReporte<FilaBalanceGeneral>> {
  const [balance, estado] = await Promise.all([
    contexto.supabase.rpc("reporte_balance_general", {
      p_empresa_id: contexto.empresaId,
      p_fecha_corte: fechaCorte,
    }),
    consultarEstadoResultados(
      contexto,
      `${fechaCorte.slice(0, 4)}-01-01`,
      fechaCorte,
    ),
  ]);

  if (balance.error) return { ok: false, error: balance.error.message };

  const filas: FilaBalanceGeneral[] = (balance.data ?? []).map((fila) => ({
    clasificacion: fila.clasificacion,
    cuentaId: fila.cuenta_id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    monto: aNumero(fila.monto),
  }));

  return {
    ok: true,
    filas,
    resultado: estado.ok ? estado.resultado : 0,
  };
}

async function consultarFlujoEfectivo(
  contexto: ContextoAccion,
  desde: string,
  hasta: string,
): Promise<ResultadoReporte<FilaFlujoEfectivo>> {
  const { data, error } = await contexto.supabase.rpc(
    "reporte_flujo_efectivo",
    {
      p_empresa_id: contexto.empresaId,
      p_desde: desde,
      p_hasta: hasta,
    },
  );

  if (error) return { ok: false, error: error.message };

  const filas: FilaFlujoEfectivo[] = (data ?? []).map((fila) => ({
    categoria: fila.categoria,
    monto: aNumero(fila.monto),
  }));

  const resultadoNeto = filas.reduce(
    (acumulado, fila) => acumulado + fila.monto,
    0,
  );

  return { ok: true, filas, resultado: resultadoNeto };
}

export async function consultarEstadoResultadosAction(entrada: {
  desde: string;
  hasta: string;
}): Promise<ResultadoReporte<FilaEstadoResultados>> {
  const preparado = await prepararAccion();
  if (!preparado.ok) return { ok: false, error: preparado.error };

  const resultado = esquemaRango.safeParse(entrada);
  if (!resultado.success) {
    return { ok: false, error: "Revisa el rango de fechas." };
  }

  const { desde, hasta } = resultado.data;

  if (desde > hasta) {
    return { ok: false, error: "La fecha inicial no puede superar la final." };
  }

  try {
    return await consultarEstadoResultados(preparado.contexto, desde, hasta);
  } catch (error) {
    return { ok: false, error: errorDeExcepcion(error) };
  }
}

export async function consultarBalanceGeneralAction(entrada: {
  fechaCorte: string;
}): Promise<ResultadoReporte<FilaBalanceGeneral>> {
  const preparado = await prepararAccion();
  if (!preparado.ok) return { ok: false, error: preparado.error };

  const resultado = esquemaCorte.safeParse(entrada);
  if (!resultado.success) {
    return { ok: false, error: "Revisa la fecha de corte." };
  }

  const { fechaCorte } = resultado.data;

  try {
    return await consultarBalanceGeneral(preparado.contexto, fechaCorte);
  } catch (error) {
    return { ok: false, error: errorDeExcepcion(error) };
  }
}

export async function consultarFlujoEfectivoAction(entrada: {
  desde: string;
  hasta: string;
}): Promise<ResultadoReporte<FilaFlujoEfectivo>> {
  const preparado = await prepararAccion();
  if (!preparado.ok) return { ok: false, error: preparado.error };

  const resultado = esquemaRango.safeParse(entrada);
  if (!resultado.success) {
    return { ok: false, error: "Revisa el rango de fechas." };
  }

  const { desde, hasta } = resultado.data;

  if (desde > hasta) {
    return { ok: false, error: "La fecha inicial no puede superar la final." };
  }

  try {
    return await consultarFlujoEfectivo(preparado.contexto, desde, hasta);
  } catch (error) {
    return { ok: false, error: errorDeExcepcion(error) };
  }
}

export async function consultarBalanzaComprobacionAction(entrada: {
  desde: string;
  hasta: string;
}): Promise<ResultadoConsulta<FilaBalanza>> {
  const preparado = await prepararAccion();
  if (!preparado.ok) return { ok: false, error: preparado.error };

  const resultado = esquemaRango.safeParse(entrada);
  if (!resultado.success) {
    return { ok: false, error: "Revisa el rango de fechas." };
  }

  const { desde, hasta } = resultado.data;

  if (desde > hasta) {
    return { ok: false, error: "La fecha inicial no puede superar la final." };
  }

  try {
    const { data, error } = await preparado.contexto.supabase.rpc(
      "reporte_balanza_comprobacion",
      {
        p_empresa_id: preparado.contexto.empresaId,
        p_desde: desde,
        p_hasta: hasta,
      },
    );

    if (error) return { ok: false, error: error.message };

    const filas: FilaBalanza[] = (data ?? []).map((fila) => ({
      cuentaId: fila.cuenta_id,
      codigo: fila.codigo,
      nombre: fila.nombre,
      clasificacion: fila.clasificacion,
      naturaleza: fila.naturaleza,
      saldoAnterior: aNumero(fila.saldo_anterior),
      debitos: aNumero(fila.debitos),
      creditos: aNumero(fila.creditos),
      saldoActual: aNumero(fila.saldo_actual),
    }));

    return { ok: true, filas };
  } catch (error) {
    return { ok: false, error: errorDeExcepcion(error) };
  }
}

export async function consultarLibroMayorAction(entrada: {
  cuentaId: string;
  desde: string;
  hasta: string;
}): Promise<ResultadoConsulta<FilaMayor>> {
  const preparado = await prepararAccion();
  if (!preparado.ok) return { ok: false, error: preparado.error };

  const resultado = esquemaMayor.safeParse(entrada);
  if (!resultado.success) {
    return { ok: false, error: "Revisa la cuenta y el rango de fechas." };
  }

  const datos = resultado.data;

  if (datos.desde > datos.hasta) {
    return { ok: false, error: "La fecha inicial no puede superar la final." };
  }

  try {
    const { data, error } = await preparado.contexto.supabase.rpc(
      "reporte_libro_mayor",
      {
        p_empresa_id: preparado.contexto.empresaId,
        p_cuenta_id: datos.cuentaId,
        p_desde: datos.desde,
        p_hasta: datos.hasta,
      },
    );

    if (error) return { ok: false, error: error.message };

    const filas: FilaMayor[] = (data ?? []).map((fila) => ({
      fecha: fila.fecha,
      asientoId: fila.asiento_id,
      asientoNumero: fila.asiento_numero,
      referencia: fila.referencia,
      descripcion: fila.descripcion,
      debito: aNumero(fila.debito),
      credito: aNumero(fila.credito),
      saldo: aNumero(fila.saldo),
    }));

    return { ok: true, filas };
  } catch (error) {
    return { ok: false, error: errorDeExcepcion(error) };
  }
}

export async function consultarCambiosPatrimonioAction(entrada: {
  desde: string;
  hasta: string;
}): Promise<ResultadoConsulta<FilaCambiosPatrimonio>> {
  const preparado = await prepararAccion();
  if (!preparado.ok) return { ok: false, error: preparado.error };

  const resultado = esquemaRango.safeParse(entrada);
  if (!resultado.success) {
    return { ok: false, error: "Revisa el rango de fechas." };
  }

  const { desde, hasta } = resultado.data;

  if (desde > hasta) {
    return { ok: false, error: "La fecha inicial no puede superar la final." };
  }

  try {
    const { data, error } = await preparado.contexto.supabase.rpc(
      "reporte_cambios_patrimonio",
      {
        p_empresa_id: preparado.contexto.empresaId,
        p_desde: desde,
        p_hasta: hasta,
      },
    );

    if (error) return { ok: false, error: error.message };

    const filas: FilaCambiosPatrimonio[] = (data ?? []).map((fila) => ({
      tipoFila: fila.tipo_fila,
      cuentaId: fila.cuenta_id,
      codigo: fila.codigo,
      nombre: fila.nombre,
      saldoInicial: aNumero(fila.saldo_inicial),
      debitos: aNumero(fila.debitos),
      creditos: aNumero(fila.creditos),
      movimientoNeto: aNumero(fila.movimiento_neto),
      saldoFinal: aNumero(fila.saldo_final),
    }));

    return { ok: true, filas };
  } catch (error) {
    return { ok: false, error: errorDeExcepcion(error) };
  }
}
