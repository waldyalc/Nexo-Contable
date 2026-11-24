import { redirect } from "next/navigation";

import {
  type AsignacionUsuario,
  type EmpresaDisponible,
  type UsuarioListado,
  UsuariosVista,
} from "@/components/usuarios/usuarios-vista";
import { obtenerContextoApp } from "@/lib/auth/sesion";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Usuarios · Nexo Contable",
};

interface PerfilFila {
  user_id: string;
  email: string;
  nombre: string;
  rol_global: string;
  activo: boolean;
  debe_definir_password: boolean;
}

interface AsignacionFila {
  user_id: string;
  empresa_id: string;
  rol: string;
  es_principal: boolean;
}

export default async function UsuariosPage() {
  const contexto = await obtenerContextoApp();

  const esAdminGlobal = contexto.perfil.rolGlobal === "admin_global";
  const esAdminEmpresa = contexto.empresas.some(
    (empresa) => empresa.rol === "admin_empresa",
  );

  if (!esAdminGlobal && !esAdminEmpresa) {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  const [perfilesFilas, asignacionesFilas] = await Promise.all([
    paginarConsulta<PerfilFila>(async (desde, hasta) => {
      const { data, error } = await supabase
        .from("perfiles")
        .select(
          "user_id, email, nombre, rol_global, activo, debe_definir_password",
        )
        .order("nombre", { ascending: true })
        .order("user_id", { ascending: true })
        .range(desde, hasta);
      return { data: (data as PerfilFila[] | null) ?? null, error };
    }),
    paginarConsulta<AsignacionFila>(async (desde, hasta) => {
      const { data, error } = await supabase
        .from("empresa_usuarios")
        .select("user_id, empresa_id, rol, es_principal")
        .order("user_id", { ascending: true })
        .order("empresa_id", { ascending: true })
        .range(desde, hasta);
      return { data: (data as AsignacionFila[] | null) ?? null, error };
    }),
  ]);

  const nombrePorEmpresa = new Map<string, string>(
    contexto.empresas.map((empresa) => [empresa.id, empresa.nombreComercial]),
  );

  const asignacionesPorUsuario = new Map<string, AsignacionUsuario[]>();

  for (const fila of asignacionesFilas) {
    const asignacion: AsignacionUsuario = {
      empresaId: fila.empresa_id,
      empresaNombre:
        nombrePorEmpresa.get(fila.empresa_id) ?? "Empresa sin nombre",
      rol: fila.rol,
      esPrincipal: fila.es_principal,
    };
    const existentes = asignacionesPorUsuario.get(fila.user_id) ?? [];
    existentes.push(asignacion);
    asignacionesPorUsuario.set(fila.user_id, existentes);
  }

  const usuarios: UsuarioListado[] = perfilesFilas.map((fila) => ({
    userId: fila.user_id,
    email: fila.email,
    nombre: fila.nombre,
    rolGlobal: fila.rol_global === "admin_global" ? "admin_global" : "usuario",
    activo: fila.activo,
    debeDefinirPassword: fila.debe_definir_password,
    asignaciones: asignacionesPorUsuario.get(fila.user_id) ?? [],
  }));

  const empresasDisponibles: EmpresaDisponible[] = contexto.empresas
    .filter((empresa) => esAdminGlobal || empresa.rol === "admin_empresa")
    .map((empresa) => ({
      id: empresa.id,
      nombreComercial: empresa.nombreComercial,
    }));

  return (
    <UsuariosVista
      usuarios={usuarios}
      empresasDisponibles={empresasDisponibles}
      esAdminGlobal={esAdminGlobal}
      usuarioActualId={contexto.perfil.userId}
    />
  );
}
