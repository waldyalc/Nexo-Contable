"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ResultadoOperacion } from "@/lib/operaciones/tipos";
import { createClient } from "@/lib/supabase/server";

const identificador = z.string().uuid("Identificador inválido.");

const texto = (max: number) =>
  z.string().trim().max(max, `Máximo ${max} caracteres.`);

const correoOpcional = z
  .string()
  .trim()
  .max(160, "Máximo 160 caracteres.")
  .refine(
    (valor) => valor === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor),
    "Correo inválido.",
  );

const cuentaOpcional = z
  .union([identificador, z.literal(""), z.null()])
  .optional()
  .transform((valor) => (valor === "" || valor == null ? null : valor));

const esquemaTercero = z.object({
  empresaId: identificador,
  id: identificador.optional().nullable(),
  tipo: z.enum(["customer", "supplier", "both"]),
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre del tercero es obligatorio.")
    .max(160, "Máximo 160 caracteres."),
  rnc: texto(20),
  correo: correoOpcional,
  telefono: texto(30),
  direccion: texto(300),
  cuentaPorPagarId: cuentaOpcional,
  cuentaPorCobrarId: cuentaOpcional,
  activo: z.boolean().optional(),
});

const esquemaActivo = z.object({
  empresaId: identificador,
  terceroId: identificador,
  activo: z.boolean(),
});

export interface EntradaTercero {
  empresaId: string;
  id?: string | null;
  tipo: "customer" | "supplier" | "both";
  nombre: string;
  rnc: string;
  correo: string;
  telefono: string;
  direccion: string;
  cuentaPorPagarId?: string | null;
  cuentaPorCobrarId?: string | null;
  activo?: boolean;
}

function refrescarTerceros() {
  revalidatePath("/gastos");
  revalidatePath("/facturacion");
}

async function exigirSesion(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user !== null;
}

/** Crea o actualiza un tercero (cliente, proveedor o ambos) de la empresa. */
export async function guardarTerceroAction(
  entrada: EntradaTercero,
): Promise<ResultadoOperacion<{ id: string }>> {
  if (!(await exigirSesion())) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaTercero.safeParse(entrada);
  if (!resultado.success) {
    return {
      ok: false,
      error:
        resultado.error.issues[0]?.message ?? "Revisa los datos del tercero.",
    };
  }

  const datos = resultado.data;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("guardar_tercero", {
    p_empresa_id: datos.empresaId,
    p_id: datos.id ?? null,
    p_tipo: datos.tipo,
    p_nombre: datos.nombre,
    p_rnc: datos.rnc,
    p_correo: datos.correo,
    p_telefono: datos.telefono,
    p_direccion: datos.direccion,
    p_cuenta_por_pagar_id: datos.cuentaPorPagarId,
    p_cuenta_por_cobrar_id: datos.cuentaPorCobrarId,
    p_activo: datos.activo ?? true,
  });

  if (error) return { ok: false, error: error.message };
  if (typeof data !== "string") {
    return { ok: false, error: "No pudimos confirmar el tercero guardado." };
  }

  refrescarTerceros();
  return {
    ok: true,
    mensaje: datos.id ? "Tercero actualizado." : "Tercero creado.",
    datos: { id: data },
  };
}

/** Activa o inactiva un tercero sin borrarlo (los documentos lo referencian). */
export async function toggleTerceroActivoAction(entrada: {
  empresaId: string;
  terceroId: string;
  activo: boolean;
}): Promise<ResultadoOperacion> {
  if (!(await exigirSesion())) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaActivo.safeParse(entrada);
  if (!resultado.success) {
    return { ok: false, error: "Datos del tercero inválidos." };
  }

  const datos = resultado.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc("toggle_tercero_activo", {
    p_empresa_id: datos.empresaId,
    p_tercero_id: datos.terceroId,
    p_activo: datos.activo,
  });

  if (error) return { ok: false, error: error.message };

  refrescarTerceros();
  return {
    ok: true,
    mensaje: datos.activo ? "Tercero activado." : "Tercero inactivado.",
  };
}
