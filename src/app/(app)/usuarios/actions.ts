"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type ResultadoUsuario =
  | { ok: true; mensaje: string }
  | { ok: false; error: string };

export interface DatosUsuarioForm {
  userId: string;
  nombre: string;
  rolGlobal: "admin_global" | "usuario";
  activo: boolean;
  debeDefinirPassword: boolean;
}

export interface DatosAsignacion {
  userId: string;
  empresaId: string;
  rol: string;
  esPrincipal: boolean;
}

export interface DatosRemocion {
  userId: string;
  empresaId: string;
}

const esquemaUsuario = z.object({
  userId: z.string().uuid("Usuario inválido."),
  nombre: z.string().trim().max(160, "Máximo 160 caracteres."),
  rolGlobal: z.enum(["admin_global", "usuario"]),
  activo: z.boolean(),
  debeDefinirPassword: z.boolean(),
});

const esquemaAsignacion = z.object({
  userId: z.string().uuid("Usuario inválido."),
  empresaId: z.string().uuid("Empresa inválida."),
  rol: z.enum(["admin_empresa", "contador", "auxiliar", "cliente"]),
  esPrincipal: z.boolean(),
});

const esquemaRemocion = z.object({
  userId: z.string().uuid("Usuario inválido."),
  empresaId: z.string().uuid("Empresa inválida."),
});

function refrescarListas() {
  revalidatePath("/usuarios");
  revalidatePath("/empresas");
  revalidatePath("/dashboard");
}

async function exigirSesion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return supabase;
}

export async function actualizarUsuarioAction(
  datos: DatosUsuarioForm,
): Promise<ResultadoUsuario> {
  const supabase = await exigirSesion();

  if (!supabase) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaUsuario.safeParse(datos);

  if (!resultado.success) {
    return {
      ok: false,
      error:
        resultado.error.issues[0]?.message ?? "Revisa los datos del usuario.",
    };
  }

  const { userId, nombre, rolGlobal, activo, debeDefinirPassword } =
    resultado.data;

  const { error } = await supabase.rpc("actualizar_usuario", {
    p_user_id: userId,
    p_nombre: nombre,
    p_activo: activo,
    p_rol_global: rolGlobal,
    p_debe_definir_password: debeDefinirPassword,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  refrescarListas();

  return { ok: true, mensaje: "Usuario actualizado correctamente." };
}

export async function asignarEmpresaUsuarioAction(
  datos: DatosAsignacion,
): Promise<ResultadoUsuario> {
  const supabase = await exigirSesion();

  if (!supabase) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaAsignacion.safeParse(datos);

  if (!resultado.success) {
    return {
      ok: false,
      error:
        resultado.error.issues[0]?.message ??
        "Revisa la asignación de empresa.",
    };
  }

  const { userId, empresaId, rol, esPrincipal } = resultado.data;

  const { error } = await supabase.rpc("asignar_usuario_empresa", {
    p_user_id: userId,
    p_empresa_id: empresaId,
    p_rol: rol,
    p_es_principal: esPrincipal,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  refrescarListas();

  return { ok: true, mensaje: "Empresa asignada al usuario." };
}

export async function removerEmpresaUsuarioAction(
  datos: DatosRemocion,
): Promise<ResultadoUsuario> {
  const supabase = await exigirSesion();

  if (!supabase) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaRemocion.safeParse(datos);

  if (!resultado.success) {
    return {
      ok: false,
      error:
        resultado.error.issues[0]?.message ??
        "Revisa la asignación de empresa.",
    };
  }

  const { userId, empresaId } = resultado.data;

  const { error } = await supabase.rpc("remover_usuario_empresa", {
    p_user_id: userId,
    p_empresa_id: empresaId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  refrescarListas();

  return { ok: true, mensaje: "Acceso a la empresa removido." };
}
