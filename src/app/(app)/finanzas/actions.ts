"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { obtenerContextoApp } from "@/lib/auth/sesion";
import {
  type EncabezadoReporteExcel,
  type FilaBalanceGeneralExcel,
  type FilaEstadoResultadosExcel,
  type FilaFlujoEfectivoExcel,
  construirBalanceGeneralXlsx,
  construirEstadoResultadosXlsx,
  construirFlujoEfectivoXlsx,
} from "@/lib/contabilidad/exportar-excel";
import { type Moneda, aNumero } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type ResultadoReporte<T> =
  | { ok: true; filas: T[]; resultado: number }
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

const esquemaExportacion = z.object({
  tipo: z.enum(["estado_resultados", "balance_general", "flujo_efectivo"]),
  desde: z.string().trim().optional(),
  hasta: z.string().trim().optional(),
  fechaCorte: z.string().trim().optional(),
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

export async function exportarEstadoFinancieroAction(entrada: {
  tipo: "estado_resultados" | "balance_general" | "flujo_efectivo";
  desde?: string;
  hasta?: string;
  fechaCorte?: string;
}): Promise<ResultadoExportacion> {
  const preparado = await prepararAccion();
  if (!preparado.ok) return { ok: false, error: preparado.error };

  const validado = esquemaExportacion.safeParse(entrada);
  if (!validado.success) {
    return { ok: false, error: "Revisa los datos del reporte a exportar." };
  }

  const datos = validado.data;
  const contexto = preparado.contexto;

  try {
    if (datos.tipo === "balance_general") {
      const corte = datos.fechaCorte
        ? fechaIso.safeParse(datos.fechaCorte)
        : null;
      if (corte === null || !corte.success) {
        return { ok: false, error: "Revisa la fecha de corte." };
      }

      const reporte = await consultarBalanceGeneral(contexto, corte.data);

      if (!reporte.ok) return { ok: false, error: reporte.error };

      const encabezado: EncabezadoReporteExcel = {
        empresa: contexto.empresaNombre,
        fechaCorte: corte.data,
      };

      const filas: FilaBalanceGeneralExcel[] = reporte.filas.map((fila) => ({
        clasificacion: fila.clasificacion,
        codigo: fila.codigo,
        nombre: fila.nombre,
        monto: fila.monto,
      }));

      const buffer = await construirBalanceGeneralXlsx(
        encabezado,
        filas,
        reporte.resultado,
      );

      return {
        ok: true,
        archivo: `balance-general-${corte.data}.xlsx`,
        base64: buffer.toString("base64"),
      };
    }

    const desde = datos.desde ? fechaIso.safeParse(datos.desde) : null;
    const hasta = datos.hasta ? fechaIso.safeParse(datos.hasta) : null;

    if (desde === null || !desde.success || hasta === null || !hasta.success) {
      return { ok: false, error: "Revisa el rango de fechas." };
    }

    const encabezado: EncabezadoReporteExcel = {
      empresa: contexto.empresaNombre,
      desde: desde.data,
      hasta: hasta.data,
    };

    if (datos.tipo === "estado_resultados") {
      const reporte = await consultarEstadoResultados(
        contexto,
        desde.data,
        hasta.data,
      );

      if (!reporte.ok) return { ok: false, error: reporte.error };

      const filas: FilaEstadoResultadosExcel[] = reporte.filas.map((fila) => ({
        clasificacion: fila.clasificacion,
        codigo: fila.codigo,
        nombre: fila.nombre,
        monto: fila.monto,
      }));

      const buffer = await construirEstadoResultadosXlsx(encabezado, filas);

      return {
        ok: true,
        archivo: `estado-resultados-${desde.data}-${hasta.data}.xlsx`,
        base64: buffer.toString("base64"),
      };
    }

    const reporte = await consultarFlujoEfectivo(
      contexto,
      desde.data,
      hasta.data,
    );

    if (!reporte.ok) return { ok: false, error: reporte.error };

    const filas: FilaFlujoEfectivoExcel[] = reporte.filas.map((fila) => ({
      categoria: fila.categoria,
      monto: fila.monto,
    }));

    const buffer = await construirFlujoEfectivoXlsx(encabezado, filas);

    return {
      ok: true,
      archivo: `flujo-efectivo-${desde.data}-${hasta.data}.xlsx`,
      base64: buffer.toString("base64"),
    };
  } catch (error) {
    return { ok: false, error: errorDeExcepcion(error) };
  }
}
