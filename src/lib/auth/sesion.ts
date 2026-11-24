import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

/** Cookie que recuerda la empresa activa del usuario entre sesiones. */
export const COOKIE_EMPRESA_ACTIVA = "nexo_empresa_id";

export type RolGlobal = "admin_global" | "usuario";

export type RolEmpresa = "admin_empresa" | "contador" | "auxiliar" | "cliente";

/** Rol efectivo del usuario: su rol global o el rol que tiene en la empresa. */
export type RolContexto = RolGlobal | RolEmpresa;

export interface PerfilActual {
  userId: string;
  email: string;
  nombre: string;
  rolGlobal: RolGlobal;
  debeDefinirPassword: boolean;
  activo: boolean;
}

export interface EmpresaAsignada {
  id: string;
  nombreComercial: string;
  razonSocial: string;
  rnc: string;
  estado: "active" | "inactive";
  fechaInicio: string | null;
  regimenFiscal: string;
  monedaFuncional: string;
  rol: RolContexto;
  esPrincipal: boolean;
}

export interface ContextoApp {
  perfil: PerfilActual;
  empresas: EmpresaAsignada[];
  empresaActiva: EmpresaAsignada | null;
  esAdminGlobal: boolean;
  rolActivo: RolContexto | null;
}

interface PerfilFila {
  user_id: string;
  email: string;
  nombre: string;
  rol_global: string;
  debe_definir_password: boolean;
  activo: boolean;
}

interface EmpresaFila {
  id: string;
  nombre_comercial: string;
  razon_social: string;
  rnc: string;
  estado: string;
  fecha_inicio: string | null;
  regimen_fiscal: string;
  moneda_funcional: string;
}

interface AsignacionFila {
  empresa_id: string;
  rol: string;
  es_principal: boolean;
}

function normalizarRolGlobal(rol: string): RolGlobal {
  return rol === "admin_global" ? "admin_global" : "usuario";
}

function normalizarRolEmpresa(rol: string): RolEmpresa {
  if (
    rol === "admin_empresa" ||
    rol === "contador" ||
    rol === "auxiliar" ||
    rol === "cliente"
  ) {
    return rol;
  }
  return "cliente";
}

function normalizarEstado(estado: string): "active" | "inactive" {
  return estado === "inactive" ? "inactive" : "active";
}

/**
 * Contexto de la aplicación autenticada: perfil, empresas visibles por RLS y
 * empresa activa. Redirige a `/login` sin sesión y a `/definir-password`
 * cuando el usuario debe crear su contraseña personal en el primer ingreso.
 */
export async function obtenerContextoApp(): Promise<ContextoApp> {
  const supabase = await createClient();

  const {
    data: { user },
    error: errorSesion,
  } = await supabase.auth.getUser();

  if (errorSesion || !user) {
    redirect("/login");
  }

  const { data: filaPerfil, error: errorPerfil } = await supabase
    .from("perfiles")
    .select("user_id, email, nombre, rol_global, debe_definir_password, activo")
    .eq("user_id", user.id)
    .maybeSingle();

  if (errorPerfil || !filaPerfil) {
    await supabase.auth.signOut();
    redirect("/login?error=no-autorizado");
  }

  const perfilFila = filaPerfil as PerfilFila;

  if (!perfilFila.activo) {
    await supabase.auth.signOut();
    redirect("/login?error=inactivo");
  }

  if (perfilFila.debe_definir_password) {
    redirect("/definir-password");
  }

  const esAdminGlobal = perfilFila.rol_global === "admin_global";

  const [empresasFilas, asignacionesFilas] = await Promise.all([
    paginarConsulta<EmpresaFila>(async (desde, hasta) => {
      const { data, error } = await supabase
        .from("empresas")
        .select(
          "id, nombre_comercial, razon_social, rnc, estado, fecha_inicio, regimen_fiscal, moneda_funcional",
        )
        .order("nombre_comercial", { ascending: true })
        .order("id", { ascending: true })
        .range(desde, hasta);
      return { data: (data as EmpresaFila[] | null) ?? null, error };
    }),
    paginarConsulta<AsignacionFila>(async (desde, hasta) => {
      const { data, error } = await supabase
        .from("empresa_usuarios")
        .select("empresa_id, rol, es_principal")
        .eq("user_id", user.id)
        .order("empresa_id", { ascending: true })
        .range(desde, hasta);
      return { data: (data as AsignacionFila[] | null) ?? null, error };
    }),
  ]);

  const asignacionPorEmpresa = new Map<string, AsignacionFila>(
    asignacionesFilas.map((asignacion) => [asignacion.empresa_id, asignacion]),
  );

  const empresas: EmpresaAsignada[] = [];

  for (const empresa of empresasFilas) {
    const asignacion = asignacionPorEmpresa.get(empresa.id);

    if (!esAdminGlobal && !asignacion) continue;

    empresas.push({
      id: empresa.id,
      nombreComercial: empresa.nombre_comercial,
      razonSocial: empresa.razon_social,
      rnc: empresa.rnc,
      estado: normalizarEstado(empresa.estado),
      fechaInicio: empresa.fecha_inicio,
      regimenFiscal: empresa.regimen_fiscal,
      monedaFuncional: empresa.moneda_funcional,
      rol: esAdminGlobal
        ? "admin_global"
        : normalizarRolEmpresa(asignacion?.rol ?? "cliente"),
      esPrincipal: asignacion?.es_principal === true,
    });
  }

  const cookieEmpresa = (await cookies()).get(COOKIE_EMPRESA_ACTIVA)?.value;

  const empresaActiva =
    empresas.find((empresa) => empresa.id === cookieEmpresa) ??
    empresas.find((empresa) => empresa.esPrincipal) ??
    empresas.find((empresa) => empresa.estado === "active") ??
    empresas[0] ??
    null;

  return {
    perfil: {
      userId: perfilFila.user_id,
      email: perfilFila.email,
      nombre: perfilFila.nombre,
      rolGlobal: normalizarRolGlobal(perfilFila.rol_global),
      debeDefinirPassword: perfilFila.debe_definir_password,
      activo: perfilFila.activo,
    },
    empresas,
    empresaActiva,
    esAdminGlobal,
    rolActivo: esAdminGlobal ? "admin_global" : (empresaActiva?.rol ?? null),
  };
}
