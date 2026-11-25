"use server";

import { z } from "zod";

import { obtenerContextoApp } from "@/lib/auth/sesion";
import { createClient } from "@/lib/supabase/server";

export interface TerceroBusqueda {
  id: string;
  tipo: "customer" | "supplier" | "both";
  nombre: string;
  rnc: string;
}

export interface DocumentoBusqueda {
  id: string;
  tipo: string;
  numero: string;
  ncf: string;
  tercero: string;
  fechaEmision: string;
  total: number;
}

export interface CuentaBusqueda {
  id: string;
  codigo: string;
  nombre: string;
  clasificacion: string;
}

export interface ResultadosBusqueda {
  terceros: TerceroBusqueda[];
  ventas: DocumentoBusqueda[];
  compras: DocumentoBusqueda[];
  cuentas: CuentaBusqueda[];
}

export type RespuestaBusqueda =
  | { ok: true; resultados: ResultadosBusqueda }
  | { ok: false; error: string };

interface TerceroFila {
  id: string;
  tipo: string;
  nombre: string;
  rnc: string;
}

interface DocumentoFila {
  id: string;
  tipo: string;
  numero: string;
  ncf: string;
  tercero_id: string;
  fecha_emision: string;
  total: number;
}

interface TerceroNombreFila {
  id: string;
  nombre: string;
}

interface CuentaFila {
  id: string;
  codigo: string;
  nombre: string;
  clasificacion: string;
}

const esquemaTermino = z
  .string()
  .trim()
  .min(2, "Escribe al menos 2 caracteres para buscar.")
  .max(60, "Máximo 60 caracteres para la búsqueda.");

function resultadosVacios(): ResultadosBusqueda {
  return { terceros: [], ventas: [], compras: [], cuentas: [] };
}

function sanearBusqueda(valor: string): string {
  return valor
    .trim()
    .replace(/[,%()_]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 60);
}

function normalizarTipoTercero(valor: string): TerceroBusqueda["tipo"] {
  if (valor === "customer" || valor === "supplier") return valor;
  return "both";
}

function mapearDocumento(
  fila: DocumentoFila,
  nombresTerceros: Map<string, string>,
): DocumentoBusqueda {
  return {
    id: fila.id,
    tipo: fila.tipo,
    numero: fila.numero,
    ncf: fila.ncf,
    tercero: nombresTerceros.get(fila.tercero_id) ?? "—",
    fechaEmision: fila.fecha_emision,
    total: Number(fila.total),
  };
}

export async function buscarGlobalAction(
  termino: string,
): Promise<RespuestaBusqueda> {
  const resultadoTermino = esquemaTermino.safeParse(termino);
  if (!resultadoTermino.success) {
    return {
      ok: false,
      error:
        resultadoTermino.error.issues[0]?.message ??
        "Revisa el término de búsqueda.",
    };
  }

  const consulta = sanearBusqueda(resultadoTermino.data);
  if (consulta.length < 2) {
    return { ok: false, error: "Escribe al menos 2 caracteres para buscar." };
  }

  const contexto = await obtenerContextoApp();
  const empresa = contexto.empresaActiva;

  if (!empresa) {
    return { ok: true, resultados: resultadosVacios() };
  }

  const supabase = await createClient();
  const patron = `%${consulta}%`;
  const filtroTerceros = `nombre.ilike.${patron},rnc.ilike.${patron},rnc_normalizado.ilike.${patron}`;
  const filtroDocumentos = `numero.ilike.${patron},ncf.ilike.${patron}`;
  const filtroCuentas = `codigo.ilike.${patron},nombre.ilike.${patron}`;

  const [tercerosConsulta, ventasConsulta, comprasConsulta, cuentasConsulta] =
    await Promise.all([
      supabase
        .from("terceros")
        .select("id, tipo, nombre, rnc")
        .eq("empresa_id", empresa.id)
        .or(filtroTerceros)
        .order("nombre", { ascending: true })
        .limit(6),
      supabase
        .from("documentos_financieros")
        .select("id, tipo, numero, ncf, tercero_id, fecha_emision, total")
        .eq("empresa_id", empresa.id)
        .in("tipo", ["sales_invoice", "sales_credit"])
        .or(filtroDocumentos)
        .order("fecha_emision", { ascending: false })
        .order("numero", { ascending: false })
        .limit(6),
      supabase
        .from("documentos_financieros")
        .select("id, tipo, numero, ncf, tercero_id, fecha_emision, total")
        .eq("empresa_id", empresa.id)
        .in("tipo", ["purchase_invoice", "purchase_credit"])
        .or(filtroDocumentos)
        .order("fecha_emision", { ascending: false })
        .order("numero", { ascending: false })
        .limit(6),
      supabase
        .from("cuentas")
        .select("id, codigo, nombre, clasificacion")
        .eq("empresa_id", empresa.id)
        .eq("activa", true)
        .or(filtroCuentas)
        .order("codigo", { ascending: true })
        .limit(6),
    ]);

  const errorConsulta = [
    tercerosConsulta.error,
    ventasConsulta.error,
    comprasConsulta.error,
    cuentasConsulta.error,
  ].find((error) => error !== null);

  if (errorConsulta) {
    return { ok: false, error: errorConsulta.message };
  }

  const filasTerceros = (tercerosConsulta.data as TerceroFila[] | null) ?? [];
  const filasVentas = (ventasConsulta.data as DocumentoFila[] | null) ?? [];
  const filasCompras = (comprasConsulta.data as DocumentoFila[] | null) ?? [];
  const filasCuentas = (cuentasConsulta.data as CuentaFila[] | null) ?? [];

  const idsTerceros = Array.from(
    new Set(
      [...filasVentas, ...filasCompras].map(
        (documento) => documento.tercero_id,
      ),
    ),
  );
  const nombresTerceros = new Map<string, string>();

  if (idsTerceros.length > 0) {
    const { data, error } = await supabase
      .from("terceros")
      .select("id, nombre")
      .eq("empresa_id", empresa.id)
      .in("id", idsTerceros)
      .limit(idsTerceros.length);

    if (error) {
      return { ok: false, error: error.message };
    }

    for (const fila of (data as TerceroNombreFila[] | null) ?? []) {
      nombresTerceros.set(fila.id, fila.nombre);
    }
  }

  return {
    ok: true,
    resultados: {
      terceros: filasTerceros.map((fila) => ({
        id: fila.id,
        tipo: normalizarTipoTercero(fila.tipo),
        nombre: fila.nombre,
        rnc: fila.rnc,
      })),
      ventas: filasVentas.map((fila) => mapearDocumento(fila, nombresTerceros)),
      compras: filasCompras.map((fila) =>
        mapearDocumento(fila, nombresTerceros),
      ),
      cuentas: filasCuentas.map((fila) => ({
        id: fila.id,
        codigo: fila.codigo,
        nombre: fila.nombre,
        clasificacion: fila.clasificacion,
      })),
    },
  };
}
