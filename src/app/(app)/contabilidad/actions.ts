"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { obtenerContextoApp } from "@/lib/auth/sesion";
import { type Moneda, aNumero } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/types";
import catalogoBase from "../../../../data/catalogo-base.json";

export type ResultadoAccion =
  | { ok: true; mensaje: string }
  | { ok: false; error: string };

export type ResultadoConsulta<T> =
  | { ok: true; filas: T[] }
  | { ok: false; error: string };

export type ResultadoExportacion =
  | { ok: true; archivo: string; base64: string }
  | { ok: false; error: string };

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

export interface LineaAsiento {
  id: string;
  asientoId: string;
  cuentaId: string;
  descripcion: string;
  debito: number;
  credito: number;
}

export interface AsientoListado {
  id: string;
  numero: string;
  fecha: string;
  tipoOperacion: string;
  descripcion: string;
  referencia: string;
  estado: string;
  reversoDe: string | null;
  revertidoPor: string | null;
}

export interface PeriodoContable {
  id: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
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

export interface EntradaCuenta {
  codigo: string;
  nombre: string;
  clasificacion: string;
  naturaleza: string;
  codigoPadre: string;
  esAgrupacion: boolean;
  esEquivalenteEfectivo: boolean;
  categoriaFlujoEfectivo: string;
}

export interface EntradaActualizarCuenta {
  cuentaId: string;
  nombre: string;
  activa: boolean;
  esAgrupacion: boolean;
  esEquivalenteEfectivo: boolean;
  categoriaFlujoEfectivo: string;
}

export interface EntradaLineaAsiento {
  cuentaId: string;
  descripcion: string;
  debito: number;
  credito: number;
}

export interface EntradaAsientoManual {
  fecha: string;
  descripcion: string;
  referencia: string;
  contabilizar: boolean;
  lineas: EntradaLineaAsiento[];
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

const ROLES_CONTABLES = new Set(["admin_global", "admin_empresa", "contador"]);

const CLASIFICACIONES = [
  "asset",
  "liability",
  "equity",
  "income",
  "cost",
  "expense",
] as const;

const NATURALEZAS = ["debit", "credit"] as const;

const CATEGORIAS_FLUJO = [
  "operating",
  "investing",
  "financing",
  "other",
] as const;

const fechaIso = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.");

const esquemaCuenta = z.object({
  codigo: z.string().trim().min(1, "El código es obligatorio.").max(24),
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(160),
  clasificacion: z.enum(CLASIFICACIONES),
  naturaleza: z.enum(NATURALEZAS),
  codigoPadre: z.string().trim().max(24),
  esAgrupacion: z.boolean(),
  esEquivalenteEfectivo: z.boolean(),
  categoriaFlujoEfectivo: z.enum(CATEGORIAS_FLUJO),
});

const esquemaActualizarCuenta = z.object({
  cuentaId: z.string().uuid("Cuenta inválida."),
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(160),
  activa: z.boolean(),
  esAgrupacion: z.boolean(),
  esEquivalenteEfectivo: z.boolean(),
  categoriaFlujoEfectivo: z.enum(CATEGORIAS_FLUJO),
});

const esquemaLineaAsiento = z.object({
  cuentaId: z.string().uuid("Cuenta inválida."),
  descripcion: z.string().trim().max(200),
  debito: z.number().min(0),
  credito: z.number().min(0),
});

const esquemaAsiento = z.object({
  fecha: fechaIso,
  descripcion: z
    .string()
    .trim()
    .min(1, "La descripción es obligatoria.")
    .max(300),
  referencia: z.string().trim().max(80),
  contabilizar: z.boolean(),
  lineas: z.array(esquemaLineaAsiento).min(2).max(100),
});

const esquemaPeriodo = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(80),
  fechaInicio: fechaIso,
  fechaFin: fechaIso,
});

const esquemaRango = z.object({
  desde: fechaIso,
  hasta: fechaIso,
});

const esquemaMayor = esquemaRango.extend({
  cuentaId: z.string().uuid("Cuenta inválida."),
});

function refrescar() {
  revalidatePath("/contabilidad");
  revalidatePath("/dashboard");
  revalidatePath("/finanzas");
}

async function prepararAccion(): Promise<ResultadoContexto> {
  const contexto = await obtenerContextoApp();
  const empresa = contexto.empresaActiva;

  if (!empresa) {
    return {
      ok: false,
      error: "Selecciona una empresa para trabajar en contabilidad.",
    };
  }

  const rol = contexto.esAdminGlobal ? "admin_global" : empresa.rol;

  if (!ROLES_CONTABLES.has(rol)) {
    return {
      ok: false,
      error: "Tu rol no tiene acceso al módulo de contabilidad.",
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

function redondearCentavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

// ---------------------------------------------------------------------------
// Catálogo de cuentas
// ---------------------------------------------------------------------------

export async function importarCatalogoBaseAction(): Promise<ResultadoAccion> {
  const preparado = await prepararAccion();
  if (!preparado.ok) return { ok: false, error: preparado.error };

  try {
    const { data, error } = await preparado.contexto.supabase.rpc(
      "importar_catalogo_cuentas",
      {
        p_empresa_id: preparado.contexto.empresaId,
        p_cuentas: catalogoBase,
      },
    );

    if (error) return { ok: false, error: error.message };

    refrescar();

    const insertadas = typeof data === "number" ? data : 0;
    return {
      ok: true,
      mensaje:
        insertadas === 1
          ? "Catálogo base cargado: 1 cuenta nueva."
          : `Catálogo base cargado: ${insertadas} cuentas nuevas.`,
    };
  } catch (error) {
    return { ok: false, error: errorDeExcepcion(error) };
  }
}

const MAPA_CLASIFICACION: Record<string, (typeof CLASIFICACIONES)[number]> = {
  activo: "asset",
  activos: "asset",
  asset: "asset",
  pasivo: "liability",
  pasivos: "liability",
  liability: "liability",
  patrimonio: "equity",
  capital: "equity",
  equity: "equity",
  ingreso: "income",
  ingresos: "income",
  income: "income",
  revenue: "income",
  costo: "cost",
  costos: "cost",
  cost: "cost",
  gasto: "expense",
  gastos: "expense",
  expense: "expense",
};

const MAPA_NATURALEZA: Record<string, (typeof NATURALEZAS)[number]> = {
  debito: "debit",
  débito: "debit",
  debe: "debit",
  deudora: "debit",
  debit: "debit",
  credito: "credit",
  crédito: "credit",
  haber: "credit",
  acreedora: "credit",
  credit: "credit",
};

const ALIAS_COLUMNAS: Record<string, string> = {
  codigo: "code",
  code: "code",
  nombre: "name",
  name: "name",
  clasificacion: "classification",
  classification: "classification",
  naturaleza: "normal_balance",
  normal_balance: "normal_balance",
  codigo_padre: "parent_code",
  "codigo padre": "parent_code",
  padre: "parent_code",
  parent_code: "parent_code",
  es_agrupacion: "is_header",
  agrupacion: "is_header",
  is_header: "is_header",
};

function normalizarTexto(valor: string): string {
  return valor.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();
}

function parsearCsv(texto: string): string[][] {
  const limpio = texto.replace(/^\uFEFF/, "");
  const primeraLinea = limpio.split(/\r?\n/, 1)[0] ?? "";
  const delimitador = primeraLinea.includes(";") ? ";" : ",";
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let entreComillas = false;

  for (let indice = 0; indice < limpio.length; indice += 1) {
    const caracter = limpio[indice];

    if (caracter === undefined) continue;

    if (entreComillas) {
      if (caracter === '"') {
        if (limpio[indice + 1] === '"') {
          campo += '"';
          indice += 1;
        } else {
          entreComillas = false;
        }
      } else {
        campo += caracter;
      }
      continue;
    }

    if (caracter === '"') {
      entreComillas = true;
      continue;
    }

    if (caracter === delimitador) {
      fila.push(campo);
      campo = "";
      continue;
    }

    if (caracter === "\n") {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
      continue;
    }

    if (caracter === "\r") continue;

    campo += caracter;
  }

  if (campo !== "" || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }

  return filas.filter((registro) =>
    registro.some((celda) => celda.trim() !== ""),
  );
}

function esVerdadero(valor: string): boolean {
  const normalizado = normalizarTexto(valor);
  return (
    normalizado === "1" ||
    normalizado === "true" ||
    normalizado === "si" ||
    normalizado === "x" ||
    normalizado === "yes"
  );
}

function convertirCatalogoCsv(texto: string): Json {
  const filas = parsearCsv(texto);

  if (filas.length < 2) {
    throw new Error("El CSV debe incluir encabezados y al menos una cuenta.");
  }

  const encabezados = filas[0] ?? [];
  const indices = new Map<string, number>();

  encabezados.forEach((encabezado, indice) => {
    const clave =
      ALIAS_COLUMNAS[normalizarTexto(encabezado).replace(/\s+/g, "_")];
    if (clave) indices.set(clave, indice);
  });

  if (!indices.has("code") || !indices.has("name")) {
    throw new Error(
      "El CSV debe incluir las columnas codigo y nombre (además de clasificacion, naturaleza, codigo_padre y es_agrupacion).",
    );
  }

  const cuentas: Json[] = [];

  for (let indice = 1; indice < filas.length; indice += 1) {
    const fila = filas[indice];
    if (!fila) continue;

    const leer = (clave: string): string => {
      const posicion = indices.get(clave);
      if (posicion === undefined) return "";
      return (fila[posicion] ?? "").trim();
    };

    const code = leer("code");
    const name = leer("name");

    if (code === "" || name === "") {
      throw new Error(
        `Fila ${indice + 1}: el código y el nombre de la cuenta son obligatorios.`,
      );
    }

    const clasificacion = normalizarTexto(leer("classification"));
    const naturaleza = normalizarTexto(leer("normal_balance"));

    const classification =
      clasificacion === "" ? "" : MAPA_CLASIFICACION[clasificacion];
    const normalBalance = naturaleza === "" ? "" : MAPA_NATURALEZA[naturaleza];

    if (classification === undefined) {
      throw new Error(
        `Fila ${indice + 1}: clasificación inválida "${leer("classification")}".`,
      );
    }

    if (normalBalance === undefined) {
      throw new Error(
        `Fila ${indice + 1}: naturaleza inválida "${leer("normal_balance")}".`,
      );
    }

    cuentas.push({
      code,
      name,
      classification,
      normal_balance: normalBalance,
      parent_code: leer("parent_code"),
      is_header: esVerdadero(leer("is_header")),
    });
  }

  return cuentas;
}

export async function importarCatalogoCsvAction(
  csv: string,
): Promise<ResultadoAccion> {
  const preparado = await prepararAccion();
  if (!preparado.ok) return { ok: false, error: preparado.error };

  const resultado = z
    .string()
    .min(1, "El archivo CSV está vacío.")
    .max(2_000_000, "El archivo CSV supera el tamaño permitido.")
    .safeParse(csv);
  if (!resultado.success) {
    return {
      ok: false,
      error: resultado.error.issues[0]?.message ?? "CSV inválido.",
    };
  }

  try {
    const cuentas = convertirCatalogoCsv(resultado.data);

    const { data, error } = await preparado.contexto.supabase.rpc(
      "importar_catalogo_cuentas",
      {
        p_empresa_id: preparado.contexto.empresaId,
        p_cuentas: cuentas,
      },
    );

    if (error) return { ok: false, error: error.message };

    refrescar();

    const insertadas = typeof data === "number" ? data : 0;
    return {
      ok: true,
      mensaje: `Catálogo importado: ${insertadas} cuentas nuevas.`,
    };
  } catch (error) {
    return { ok: false, error: errorDeExcepcion(error) };
  }
}

export async function crearCuentaAction(
  entrada: EntradaCuenta,
): Promise<ResultadoAccion> {
  const preparado = await prepararAccion();
  if (!preparado.ok) return { ok: false, error: preparado.error };

  const resultado = esquemaCuenta.safeParse(entrada);
  if (!resultado.success) {
    return {
      ok: false,
      error:
        resultado.error.issues[0]?.message ?? "Revisa los datos de la cuenta.",
    };
  }

  const datos = resultado.data;

  try {
    let padreId: string | null = null;

    if (datos.codigoPadre !== "") {
      const { data: padre, error: errorPadre } =
        await preparado.contexto.supabase
          .from("cuentas")
          .select("id")
          .eq("empresa_id", preparado.contexto.empresaId)
          .eq("codigo", datos.codigoPadre)
          .maybeSingle();

      if (errorPadre) return { ok: false, error: errorPadre.message };

      if (!padre) {
        return {
          ok: false,
          error: `No existe una cuenta padre con el código ${datos.codigoPadre}.`,
        };
      }

      const filaPadre = padre as { id: string };
      padreId = filaPadre.id;
    }

    const { error } = await preparado.contexto.supabase.rpc("crear_cuenta", {
      p_empresa_id: preparado.contexto.empresaId,
      p_codigo: datos.codigo,
      p_nombre: datos.nombre,
      p_clasificacion: datos.clasificacion,
      p_naturaleza: datos.naturaleza,
      p_padre_id: padreId,
      p_es_agrupacion: datos.esAgrupacion,
      p_es_equivalente_efectivo: datos.esEquivalenteEfectivo,
      p_categoria_flujo_efectivo: datos.categoriaFlujoEfectivo,
    });

    if (error) return { ok: false, error: error.message };

    refrescar();
    return {
      ok: true,
      mensaje: `Cuenta ${datos.codigo} creada correctamente.`,
    };
  } catch (error) {
    return { ok: false, error: errorDeExcepcion(error) };
  }
}

export async function actualizarCuentaAction(
  entrada: EntradaActualizarCuenta,
): Promise<ResultadoAccion> {
  const preparado = await prepararAccion();
  if (!preparado.ok) return { ok: false, error: preparado.error };

  const resultado = esquemaActualizarCuenta.safeParse(entrada);
  if (!resultado.success) {
    return {
      ok: false,
      error:
        resultado.error.issues[0]?.message ?? "Revisa los datos de la cuenta.",
    };
  }

  const datos = resultado.data;

  try {
    const { error } = await preparado.contexto.supabase.rpc(
      "actualizar_cuenta",
      {
        p_empresa_id: preparado.contexto.empresaId,
        p_cuenta_id: datos.cuentaId,
        p_nombre: datos.nombre,
        p_activa: datos.activa,
        p_es_agrupacion: datos.esAgrupacion,
        p_es_equivalente_efectivo: datos.esEquivalenteEfectivo,
        p_categoria_flujo_efectivo: datos.categoriaFlujoEfectivo,
      },
    );

    if (error) return { ok: false, error: error.message };

    refrescar();
    return { ok: true, mensaje: "Cuenta actualizada correctamente." };
  } catch (error) {
    return { ok: false, error: errorDeExcepcion(error) };
  }
}

// ---------------------------------------------------------------------------
// Asientos manuales
// ---------------------------------------------------------------------------

export async function crearAsientoManualAction(
  entrada: EntradaAsientoManual,
): Promise<ResultadoAccion> {
  const preparado = await prepararAccion();
  if (!preparado.ok) return { ok: false, error: preparado.error };

  const resultado = esquemaAsiento.safeParse(entrada);
  if (!resultado.success) {
    return {
      ok: false,
      error:
        resultado.error.issues[0]?.message ?? "Revisa las líneas del asiento.",
    };
  }

  const datos = resultado.data;
  const lineasRedondeadas = datos.lineas.map((linea) => ({
    ...linea,
    debito: redondearCentavos(linea.debito),
    credito: redondearCentavos(linea.credito),
  }));

  const lineaInvalida = lineasRedondeadas.find(
    (linea) => linea.debito > 0 === linea.credito > 0,
  );

  if (lineaInvalida) {
    return {
      ok: false,
      error:
        "Cada línea debe registrar débito o crédito, nunca ambos ni ninguno.",
    };
  }

  const totalDebito = lineasRedondeadas.reduce(
    (acumulado, linea) => acumulado + linea.debito,
    0,
  );
  const totalCredito = lineasRedondeadas.reduce(
    (acumulado, linea) => acumulado + linea.credito,
    0,
  );

  if (datos.contabilizar && Math.abs(totalDebito - totalCredito) > 0.004) {
    return {
      ok: false,
      error:
        "El asiento está descuadrado: los débitos deben igualar los créditos.",
    };
  }

  const lineas: Json = lineasRedondeadas.map((linea) => ({
    cuenta_id: linea.cuentaId,
    descripcion: linea.descripcion,
    debito: linea.debito,
    credito: linea.credito,
  }));

  try {
    const { error } = await preparado.contexto.supabase.rpc(
      "crear_asiento_manual",
      {
        p_empresa_id: preparado.contexto.empresaId,
        p_fecha: datos.fecha,
        p_descripcion: datos.descripcion,
        p_referencia: datos.referencia,
        p_lineas: lineas,
        p_contabilizar: datos.contabilizar,
      },
    );

    if (error) return { ok: false, error: error.message };

    refrescar();
    return {
      ok: true,
      mensaje: datos.contabilizar
        ? "Asiento contabilizado correctamente."
        : "Asiento guardado como borrador.",
    };
  } catch (error) {
    return { ok: false, error: errorDeExcepcion(error) };
  }
}

export async function contabilizarAsientoAction(
  asientoId: string,
): Promise<ResultadoAccion> {
  const preparado = await prepararAccion();
  if (!preparado.ok) return { ok: false, error: preparado.error };

  const identificador = z
    .string()
    .uuid("Asiento inválido.")
    .safeParse(asientoId);
  if (!identificador.success) {
    return { ok: false, error: "Asiento inválido." };
  }

  try {
    const { error } = await preparado.contexto.supabase.rpc(
      "contabilizar_asiento_borrador",
      {
        p_empresa_id: preparado.contexto.empresaId,
        p_asiento_id: identificador.data,
      },
    );

    if (error) return { ok: false, error: error.message };

    refrescar();
    return { ok: true, mensaje: "Asiento contabilizado correctamente." };
  } catch (error) {
    return { ok: false, error: errorDeExcepcion(error) };
  }
}

export async function revertirAsientoAction(entrada: {
  asientoId: string;
  fecha: string;
  motivo: string;
}): Promise<ResultadoAccion> {
  const preparado = await prepararAccion();
  if (!preparado.ok) return { ok: false, error: preparado.error };

  const esquema = z.object({
    asientoId: z.string().uuid("Asiento inválido."),
    fecha: z.string().trim(),
    motivo: z.string().trim().max(200),
  });

  const resultado = esquema.safeParse(entrada);
  if (!resultado.success) {
    return { ok: false, error: "Revisa los datos del reverso." };
  }

  const datos = resultado.data;
  const fecha =
    datos.fecha === "" ? undefined : fechaIso.safeParse(datos.fecha);

  if (fecha !== undefined && !fecha.success) {
    return { ok: false, error: "Fecha de reverso inválida." };
  }

  try {
    const { error } = await preparado.contexto.supabase.rpc(
      "revertir_asiento",
      {
        p_empresa_id: preparado.contexto.empresaId,
        p_asiento_id: datos.asientoId,
        p_fecha_reverso: fecha?.success ? fecha.data : undefined,
        p_motivo: datos.motivo === "" ? undefined : datos.motivo,
      },
    );

    if (error) return { ok: false, error: error.message };

    refrescar();
    return { ok: true, mensaje: "Asiento revertido con su contrapartida." };
  } catch (error) {
    return { ok: false, error: errorDeExcepcion(error) };
  }
}

// ---------------------------------------------------------------------------
// Períodos contables
// ---------------------------------------------------------------------------

export async function crearPeriodoAction(entrada: {
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
}): Promise<ResultadoAccion> {
  const preparado = await prepararAccion();
  if (!preparado.ok) return { ok: false, error: preparado.error };

  const resultado = esquemaPeriodo.safeParse(entrada);
  if (!resultado.success) {
    return {
      ok: false,
      error: resultado.error.issues[0]?.message ?? "Revisa el período.",
    };
  }

  const datos = resultado.data;

  if (datos.fechaFin < datos.fechaInicio) {
    return {
      ok: false,
      error: "La fecha final no puede ser anterior a la fecha inicial.",
    };
  }

  try {
    const { error } = await preparado.contexto.supabase.rpc(
      "crear_periodo_contable",
      {
        p_empresa_id: preparado.contexto.empresaId,
        p_nombre: datos.nombre,
        p_fecha_inicio: datos.fechaInicio,
        p_fecha_fin: datos.fechaFin,
      },
    );

    if (error) return { ok: false, error: error.message };

    refrescar();
    return { ok: true, mensaje: "Período contable creado correctamente." };
  } catch (error) {
    return { ok: false, error: errorDeExcepcion(error) };
  }
}

export async function cerrarPeriodoAction(
  periodoId: string,
): Promise<ResultadoAccion> {
  const preparado = await prepararAccion();
  if (!preparado.ok) return { ok: false, error: preparado.error };

  const identificador = z
    .string()
    .uuid("Período inválido.")
    .safeParse(periodoId);
  if (!identificador.success) {
    return { ok: false, error: "Período inválido." };
  }

  try {
    const { error } = await preparado.contexto.supabase.rpc(
      "cerrar_periodo_contable",
      {
        p_empresa_id: preparado.contexto.empresaId,
        p_periodo_id: identificador.data,
      },
    );

    if (error) return { ok: false, error: error.message };

    refrescar();
    return { ok: true, mensaje: "Período cerrado correctamente." };
  } catch (error) {
    return { ok: false, error: errorDeExcepcion(error) };
  }
}

export async function reabrirPeriodoAction(
  periodoId: string,
): Promise<ResultadoAccion> {
  const preparado = await prepararAccion();
  if (!preparado.ok) return { ok: false, error: preparado.error };

  const identificador = z
    .string()
    .uuid("Período inválido.")
    .safeParse(periodoId);
  if (!identificador.success) {
    return { ok: false, error: "Período inválido." };
  }

  try {
    const { error } = await preparado.contexto.supabase.rpc(
      "reabrir_periodo_contable",
      {
        p_empresa_id: preparado.contexto.empresaId,
        p_periodo_id: identificador.data,
      },
    );

    if (error) return { ok: false, error: error.message };

    refrescar();
    return { ok: true, mensaje: "Período reabierto correctamente." };
  } catch (error) {
    return { ok: false, error: errorDeExcepcion(error) };
  }
}

// ---------------------------------------------------------------------------
// Reportes contables
// ---------------------------------------------------------------------------

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

export async function consultarBalanzaAction(entrada: {
  desde: string;
  hasta: string;
}): Promise<ResultadoConsulta<FilaBalanza>> {
  const preparado = await prepararAccion();
  if (!preparado.ok) return { ok: false, error: preparado.error };

  const resultado = esquemaRango.safeParse(entrada);
  if (!resultado.success) {
    return { ok: false, error: "Revisa el rango de fechas." };
  }

  const datos = resultado.data;

  if (datos.desde > datos.hasta) {
    return { ok: false, error: "La fecha inicial no puede superar la final." };
  }

  try {
    const { data, error } = await preparado.contexto.supabase.rpc(
      "reporte_balanza_comprobacion",
      {
        p_empresa_id: preparado.contexto.empresaId,
        p_desde: datos.desde,
        p_hasta: datos.hasta,
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
