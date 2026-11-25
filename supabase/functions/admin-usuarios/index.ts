import { type SupabaseClient, createClient } from "@supabase/supabase-js";

import {
  validarPayloadCrearUsuario,
  validarPayloadRestablecerPassword,
} from "../_shared/admin-usuarios-validacion.ts";

const ENCABEZADOS_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface PerfilFila {
  user_id: string;
  rol_global: string;
  activo: boolean;
}

interface EmpresaFila {
  id: string;
  estado: string;
}

function respuestaJson(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: {
      ...ENCABEZADOS_CORS,
      "Content-Type": "application/json",
    },
  });
}

function respuestaError(estado: number, error: string): Response {
  return respuestaJson({ ok: false, error }, estado);
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function mensajeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function errorTienePropiedades(
  error: unknown,
): error is Record<string, unknown> {
  return typeof error === "object" && error !== null;
}

function esErrorCorreoDuplicado(error: unknown): boolean {
  if (!errorTienePropiedades(error)) return false;

  const codigo = typeof error.code === "string" ? error.code.toLowerCase() : "";
  const mensaje =
    typeof error.message === "string" ? error.message.toLowerCase() : "";

  return (
    codigo === "email_exists" ||
    codigo === "user_already_exists" ||
    mensaje.includes("already registered") ||
    mensaje.includes("already exists") ||
    mensaje.includes("duplicate")
  );
}

function estadoHttpCliente(error: unknown): number | null {
  if (!errorTienePropiedades(error) || typeof error.status !== "number") {
    return null;
  }
  return [400, 404, 409, 422].includes(error.status) ? error.status : null;
}

function envRequerido(nombre: string): string | null {
  const valor = Deno.env.get(nombre);
  return valor && valor.trim() !== "" ? valor : null;
}

async function registrarAuditoria(
  admin: SupabaseClient,
  actorId: string,
  accion: string,
  entidadId: string,
  detalles: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin.from("auditoria").insert({
    actor_id: actorId,
    empresa_id: null,
    accion,
    entidad: "perfiles",
    entidad_id: entidadId,
    detalles,
  });

  if (error) {
    console.error("No se pudo registrar la auditoría administrativa", error);
  }
}

async function compensarUsuarioCreado(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error(
      `No se pudo compensar el usuario Auth ${userId} tras una creación incompleta`,
      error,
    );
  }
}

async function crearUsuario(
  admin: SupabaseClient,
  actorId: string,
  payload: unknown,
): Promise<Response> {
  const validacion = validarPayloadCrearUsuario(payload);
  if (!validacion.ok) return respuestaError(400, validacion.error);

  const datos = validacion.datos;

  const { data: perfilExistente, error: errorConsultaPerfil } = await admin
    .from("perfiles")
    .select("user_id")
    .eq("email", datos.email)
    .maybeSingle();

  if (errorConsultaPerfil) {
    console.error("Error consultando correo existente", errorConsultaPerfil);
    return respuestaError(500, "No se pudo verificar si el correo ya existe.");
  }

  if (perfilExistente) {
    return respuestaError(
      409,
      "Ya existe un usuario registrado con ese correo.",
    );
  }

  const empresaIds = datos.empresas.map((empresa) => empresa.empresa_id);

  if (empresaIds.length > 0) {
    const { data: empresasData, error: errorEmpresas } = await admin
      .from("empresas")
      .select("id, estado")
      .in("id", empresaIds);

    if (errorEmpresas) {
      console.error("Error consultando empresas para asignar", errorEmpresas);
      return respuestaError(
        500,
        "No se pudieron verificar las empresas seleccionadas.",
      );
    }

    const empresas = (empresasData ?? []) as EmpresaFila[];
    const estadosPorId = new Map(
      empresas.map((empresa) => [empresa.id.toLowerCase(), empresa.estado]),
    );

    for (const empresaId of empresaIds) {
      const estado = estadosPorId.get(empresaId.toLowerCase());
      if (!estado) {
        return respuestaError(
          422,
          "Una de las empresas seleccionadas no existe.",
        );
      }
      if (estado !== "active") {
        return respuestaError(
          422,
          "Solo se pueden asignar empresas activas al crear el usuario.",
        );
      }
    }
  }

  const { data: usuarioAuth, error: errorAuth } =
    await admin.auth.admin.createUser({
      email: datos.email,
      password: datos.password,
      email_confirm: true,
      user_metadata: { nombre: datos.nombre },
    });

  if (errorAuth) {
    if (esErrorCorreoDuplicado(errorAuth)) {
      return respuestaError(
        409,
        "Ya existe un usuario registrado con ese correo.",
      );
    }
    console.error("Error creando usuario Auth", errorAuth);
    return respuestaError(
      estadoHttpCliente(errorAuth) ?? 500,
      `No se pudo crear la cuenta de autenticación: ${mensajeError(errorAuth)}`,
    );
  }

  const userId = usuarioAuth.user?.id;
  if (!userId) {
    return respuestaError(
      500,
      "Supabase Auth no devolvió el identificador del usuario creado.",
    );
  }

  const { error: errorPerfil } = await admin.from("perfiles").upsert(
    {
      user_id: userId,
      email: datos.email,
      nombre: datos.nombre,
      rol_global: datos.rol_global,
      activo: datos.activo,
      debe_definir_password: false,
    },
    { onConflict: "user_id" },
  );

  if (errorPerfil) {
    console.error("Error creando perfil; compensando Auth", errorPerfil);
    await compensarUsuarioCreado(admin, userId);
    return respuestaError(
      500,
      `No se pudo crear el perfil del usuario: ${mensajeError(errorPerfil)}`,
    );
  }

  if (datos.empresas.length > 0) {
    const filas = datos.empresas.map((empresa, indice) => ({
      user_id: userId,
      empresa_id: empresa.empresa_id,
      rol: empresa.rol,
      es_principal: indice === 0,
    }));

    const { error: errorAsignaciones } = await admin
      .from("empresa_usuarios")
      .insert(filas);

    if (errorAsignaciones) {
      console.error(
        "Error asignando empresas; compensando usuario creado",
        errorAsignaciones,
      );
      await compensarUsuarioCreado(admin, userId);
      return respuestaError(
        500,
        `No se pudieron asignar las empresas: ${mensajeError(errorAsignaciones)}`,
      );
    }
  }

  await registrarAuditoria(admin, actorId, "crear_usuario_admin", userId, {
    email: datos.email,
    rol_global: datos.rol_global,
    activo: datos.activo,
    empresas: datos.empresas,
  });

  return respuestaJson(
    {
      ok: true,
      user_id: userId,
      email: datos.email,
      empresas_asignadas: datos.empresas.length,
    },
    201,
  );
}

async function restablecerPassword(
  admin: SupabaseClient,
  actorId: string,
  payload: unknown,
): Promise<Response> {
  const validacion = validarPayloadRestablecerPassword(payload);
  if (!validacion.ok) return respuestaError(400, validacion.error);

  const datos = validacion.datos;

  const { data: perfil, error: errorPerfilConsulta } = await admin
    .from("perfiles")
    .select("user_id")
    .eq("user_id", datos.user_id)
    .maybeSingle();

  if (errorPerfilConsulta) {
    console.error(
      "Error consultando perfil a restablecer",
      errorPerfilConsulta,
    );
    return respuestaError(500, "No se pudo verificar el usuario solicitado.");
  }

  if (!perfil) {
    return respuestaError(404, "El usuario indicado no existe.");
  }

  const { error: errorAuth } = await admin.auth.admin.updateUserById(
    datos.user_id,
    { password: datos.password },
  );

  if (errorAuth) {
    console.error("Error actualizando contraseña en Auth", errorAuth);
    return respuestaError(
      estadoHttpCliente(errorAuth) ?? 500,
      `No se pudo actualizar la contraseña: ${mensajeError(errorAuth)}`,
    );
  }

  const { error: errorPerfil } = await admin
    .from("perfiles")
    .update({ debe_definir_password: false })
    .eq("user_id", datos.user_id);

  if (errorPerfil) {
    console.error(
      "La contraseña cambió, pero no se pudo actualizar el perfil",
      errorPerfil,
    );
    return respuestaError(
      500,
      "La contraseña cambió, pero el perfil no pudo actualizarse. Revisa el usuario antes de reintentar.",
    );
  }

  await registrarAuditoria(
    admin,
    actorId,
    "restablecer_password_admin",
    datos.user_id,
    { user_id: datos.user_id },
  );

  return respuestaJson({ ok: true, user_id: datos.user_id });
}

async function manejarSolicitud(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return respuestaError(401, "Falta la sesión del administrador.");
  }

  const supabaseUrl = envRequerido("SUPABASE_URL");
  const anonKey =
    envRequerido("SUPABASE_ANON_KEY") ??
    envRequerido("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = envRequerido("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error(
      "La edge function no tiene las variables Supabase requeridas",
    );
    return respuestaError(500, "La función no está configurada correctamente.");
  }

  const clienteUsuario = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace(/^bearer\s+/i, "");
  const { data: datosUsuario, error: errorUsuario } =
    await clienteUsuario.auth.getUser(token);

  if (errorUsuario || !datosUsuario.user) {
    return respuestaError(401, "La sesión es inválida o expiró.");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: perfilData, error: errorPerfil } = await admin
    .from("perfiles")
    .select("user_id, rol_global, activo")
    .eq("user_id", datosUsuario.user.id)
    .maybeSingle();

  if (errorPerfil) {
    console.error("Error verificando perfil administrador", errorPerfil);
    return respuestaError(
      500,
      "No se pudo verificar el permiso administrativo.",
    );
  }

  const perfil = (perfilData ?? null) as PerfilFila | null;
  if (!perfil || perfil.rol_global !== "admin_global" || !perfil.activo) {
    return respuestaError(
      403,
      "Solo un administrador global activo puede gestionar usuarios.",
    );
  }

  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return respuestaError(
      400,
      "El cuerpo de la solicitud debe ser JSON válido.",
    );
  }

  if (!esObjeto(cuerpo) || typeof cuerpo.operacion !== "string") {
    return respuestaError(400, "La operación solicitada es inválida.");
  }

  if (cuerpo.operacion === "crear_usuario") {
    return await crearUsuario(admin, datosUsuario.user.id, cuerpo.datos);
  }

  if (cuerpo.operacion === "restablecer_password") {
    return await restablecerPassword(admin, datosUsuario.user.id, cuerpo.datos);
  }

  return respuestaError(400, "Operación no soportada.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: ENCABEZADOS_CORS });
  }

  if (req.method !== "POST") {
    return respuestaError(405, "Método no permitido.");
  }

  try {
    return await manejarSolicitud(req);
  } catch (error) {
    console.error("Error inesperado en admin-usuarios", error);
    return respuestaError(500, "Error interno al gestionar usuarios.");
  }
});
