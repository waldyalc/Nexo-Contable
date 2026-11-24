"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type ResultadoInventario =
  | { ok: true; mensaje: string; creados?: number }
  | { ok: false; error: string };

export interface DatosArticulo {
  empresaId: string;
  id: string | null;
  sku: string;
  nombre: string;
  unidad: string;
  descripcion: string;
  precioVenta: number;
  cuentaInventarioId: string;
  cuentaCostoId: string;
  cuentaIngresoId: string;
  activo: boolean;
}

export interface FilaArticuloMasivo {
  sku: string;
  nombre: string;
  unidad: string;
  descripcion: string;
  precioVenta: number;
}

export interface DatosMovimientoInventario {
  empresaId: string;
  articuloId: string;
  fecha: string;
  tipo: "in" | "out" | "adjustment";
  cantidad: number;
  costoUnitario: number | null;
  cuentaContrapartidaId: string;
  referencia: string;
  notas: string;
  direccion: "in" | "out" | "";
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

const esquemaArticulo = z.object({
  empresaId: identificador,
  id: identificador.nullable(),
  sku: z
    .string()
    .trim()
    .min(1, "El SKU es obligatorio.")
    .max(60, "Máximo 60 caracteres."),
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre del artículo es obligatorio.")
    .max(160, "Máximo 160 caracteres."),
  unidad: texto(30),
  descripcion: texto(240),
  precioVenta: montoNoNegativo,
  cuentaInventarioId: z.union([identificador, z.literal("")]),
  cuentaCostoId: z.union([identificador, z.literal("")]),
  cuentaIngresoId: z.union([identificador, z.literal("")]),
  activo: z.boolean(),
});

const esquemaFilaMasiva = z.object({
  sku: z
    .string()
    .trim()
    .min(1, "El SKU es obligatorio.")
    .max(60, "Máximo 60 caracteres."),
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre del artículo es obligatorio.")
    .max(160, "Máximo 160 caracteres."),
  unidad: texto(30),
  descripcion: texto(240),
  precioVenta: montoNoNegativo,
});

const esquemaMovimiento = z.object({
  empresaId: identificador,
  articuloId: identificador,
  fecha,
  tipo: z.enum(["in", "out", "adjustment"]),
  cantidad: z
    .number()
    .finite("Cantidad inválida.")
    .positive("La cantidad debe ser mayor a cero."),
  costoUnitario: montoNoNegativo.nullable(),
  cuentaContrapartidaId: z.union([identificador, z.literal("")]),
  referencia: texto(120),
  notas: texto(400),
  direccion: z.union([z.literal("in"), z.literal("out"), z.literal("")]),
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
  revalidatePath("/inventario");
}

function primerError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Revisa los datos enviados.";
}

function cuentaONula(valor: string): string | null {
  return valor === "" ? null : valor;
}

export async function guardarArticuloAction(
  datos: DatosArticulo,
): Promise<ResultadoInventario> {
  const supabase = await exigirSesion();
  if (!supabase) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaArticulo.safeParse(datos);
  if (!resultado.success) {
    return { ok: false, error: primerError(resultado.error) };
  }

  const articulo = resultado.data;
  const { error } = await supabase.rpc("guardar_articulo_inventario", {
    p_empresa_id: articulo.empresaId,
    p_id: articulo.id,
    p_sku: articulo.sku,
    p_nombre: articulo.nombre,
    p_unidad: articulo.unidad,
    p_descripcion: articulo.descripcion,
    p_precio_venta: articulo.precioVenta,
    p_cuenta_inventario_id: cuentaONula(articulo.cuentaInventarioId),
    p_cuenta_costo_id: cuentaONula(articulo.cuentaCostoId),
    p_cuenta_ingreso_id: cuentaONula(articulo.cuentaIngresoId),
    p_activo: articulo.activo,
  });

  if (error) return { ok: false, error: error.message };

  refrescar();

  return {
    ok: true,
    mensaje:
      articulo.id === null
        ? "Artículo creado correctamente."
        : "Artículo actualizado correctamente.",
  };
}

export async function cargaMasivaArticulosAction(
  empresaId: string,
  filas: FilaArticuloMasivo[],
): Promise<ResultadoInventario> {
  const supabase = await exigirSesion();
  if (!supabase) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const empresa = identificador.safeParse(empresaId);
  if (!empresa.success) {
    return { ok: false, error: "Empresa inválida." };
  }

  const listado = z
    .array(esquemaFilaMasiva)
    .min(1, "El archivo no tiene artículos válidos.")
    .max(500, "La carga masiva admite hasta 500 artículos.")
    .safeParse(filas);

  if (!listado.success) {
    return { ok: false, error: primerError(listado.error) };
  }

  let creados = 0;
  let primerFallo: string | null = null;

  for (const fila of listado.data) {
    const { error } = await supabase.rpc("guardar_articulo_inventario", {
      p_empresa_id: empresa.data,
      p_sku: fila.sku,
      p_nombre: fila.nombre,
      p_unidad: fila.unidad,
      p_descripcion: fila.descripcion,
      p_precio_venta: fila.precioVenta,
    });

    if (error) {
      primerFallo ??= `${fila.sku}: ${error.message}`;
      continue;
    }

    creados += 1;
  }

  if (creados === 0) {
    return {
      ok: false,
      error: primerFallo ?? "No se pudo crear ningún artículo.",
    };
  }

  refrescar();

  return {
    ok: true,
    creados,
    mensaje:
      creados === listado.data.length
        ? `${creados} artículos creados correctamente.`
        : `${creados} de ${listado.data.length} artículos creados. Primer error: ${primerFallo}`,
  };
}

export async function registrarMovimientoInventarioAction(
  datos: DatosMovimientoInventario,
): Promise<ResultadoInventario> {
  const supabase = await exigirSesion();
  if (!supabase) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaMovimiento.safeParse(datos);
  if (!resultado.success) {
    return { ok: false, error: primerError(resultado.error) };
  }

  const movimiento = resultado.data;
  const { error } = await supabase.rpc("registrar_movimiento_inventario", {
    p_empresa_id: movimiento.empresaId,
    p_articulo_id: movimiento.articuloId,
    p_fecha: movimiento.fecha,
    p_tipo: movimiento.tipo,
    p_cantidad: movimiento.cantidad,
    p_costo_unitario:
      movimiento.tipo === "in" ? movimiento.costoUnitario : null,
    p_cuenta_contrapartida_id: cuentaONula(movimiento.cuentaContrapartidaId),
    p_referencia: movimiento.referencia,
    p_notas: movimiento.notas,
    p_direccion:
      movimiento.tipo === "adjustment" && movimiento.direccion !== ""
        ? movimiento.direccion
        : null,
  });

  if (error) return { ok: false, error: error.message };

  refrescar();

  return { ok: true, mensaje: "Movimiento de inventario registrado." };
}
