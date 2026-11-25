"use server";

import { FunctionsHttpError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import {
  type DatosCrearUsuario,
  type DatosRestablecerPasswordUsuario,
  esquemaCrearUsuario,
  esquemaRestablecerPasswordUsuario,
} from "./esquemas";

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

type ClienteSupabaseServidor = Awaited<ReturnType<typeof createClient>>;

type ResultadoInvocacion = { ok: true } | { ok: false; error: string };

interface RespuestaAdminUsuarios {
  ok?: boolean;
  error?: string;
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

async function mensajeErrorFuncion(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const cuerpo: unknown = await error.context.json();
      if (
        esObjeto(cuerpo) &&
        typeof cuerpo.error === "string" &&
        cuerpo.error.trim() !== ""
      ) {
        return cuerpo.error;
      }
    } catch {
      return error.message;
    }
  }

  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }

  return "No se pudo ejecutar la función administrativa de usuarios.";
}

async function invocarAdminUsuarios(
  supabase: ClienteSupabaseServidor,
  cuerpo: Record<string, unknown>,
): Promise<ResultadoInvocacion> {
  const { data, error } =
    await supabase.functions.invoke<RespuestaAdminUsuarios>("admin-usuarios", {
      body: cuerpo,
    });

  if (error) {
    return { ok: false, error: await mensajeErrorFuncion(error) };
  }

  if (!data || data.ok !== true) {
    return {
      ok: false,
      error:
        typeof data?.error === "string" && data.error.trim() !== ""
          ? data.error
          : "La función administrativa no confirmó la operación.",
    };
  }

  return { ok: true };
}

export async function crearUsuarioAction(
  datos: DatosCrearUsuario,
): Promise<ResultadoUsuario> {
  const supabase = await exigirSesion();

  if (!supabase) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaCrearUsuario.safeParse(datos);

  if (!resultado.success) {
    return {
      ok: false,
      error:
        resultado.error.issues[0]?.message ?? "Revisa los datos del usuario.",
    };
  }

  const datosValidados = resultado.data;
  const invocacion = await invocarAdminUsuarios(supabase, {
    operacion: "crear_usuario",
    datos: {
      email: datosValidados.email,
      password: datosValidados.password,
      nombre: datosValidados.nombre,
      rol_global: datosValidados.rolGlobal,
      activo: datosValidados.activo,
      empresas: datosValidados.empresas.map((empresa) => ({
        empresa_id: empresa.empresaId,
        rol: empresa.rol,
      })),
    },
  });

  if (!invocacion.ok) {
    return { ok: false, error: invocacion.error };
  }

  refrescarListas();

  return { ok: true, mensaje: "Usuario creado correctamente." };
}

export async function restablecerPasswordUsuarioAction(
  datos: DatosRestablecerPasswordUsuario,
): Promise<ResultadoUsuario> {
  const supabase = await exigirSesion();

  if (!supabase) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaRestablecerPasswordUsuario.safeParse(datos);

  if (!resultado.success) {
    return {
      ok: false,
      error:
        resultado.error.issues[0]?.message ?? "Revisa la nueva contraseña.",
    };
  }

  const invocacion = await invocarAdminUsuarios(supabase, {
    operacion: "restablecer_password",
    datos: {
      user_id: resultado.data.userId,
      password: resultado.data.password,
    },
  });

  if (!invocacion.ok) {
    return { ok: false, error: invocacion.error };
  }

  refrescarListas();

  return { ok: true, mensaje: "Contraseña restablecida correctamente." };
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
