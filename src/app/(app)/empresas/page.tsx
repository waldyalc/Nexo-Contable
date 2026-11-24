import {
  type EmpresaListado,
  EmpresasVista,
} from "@/components/empresas/empresas-vista";
import { type RolContexto, obtenerContextoApp } from "@/lib/auth/sesion";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Empresas · Nexo Contable",
};

interface EmpresaFila {
  id: string;
  nombre_comercial: string;
  razon_social: string;
  rnc: string;
  tipo_empresa: string;
  direccion: string;
  telefono: string;
  correo: string;
  representante_legal: string;
  actividad_economica: string;
  fecha_inicio: string | null;
  regimen_fiscal: string;
  moneda_funcional: string;
  periodo_fiscal: string;
  estado: string;
}

interface AsignacionFila {
  empresa_id: string;
  rol: string;
  es_principal: boolean;
}

function rolDeEmpresa(valor: string): RolContexto {
  if (
    valor === "admin_empresa" ||
    valor === "contador" ||
    valor === "auxiliar" ||
    valor === "cliente"
  ) {
    return valor;
  }
  return "cliente";
}

export default async function EmpresasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const contexto = await obtenerContextoApp();
  const params = await searchParams;
  const parametroNueva = params.nueva;
  const abrirNuevaInicial =
    (Array.isArray(parametroNueva) ? parametroNueva[0] : parametroNueva) ===
    "1";

  const supabase = await createClient();

  const [empresasFilas, asignacionesFilas] = await Promise.all([
    paginarConsulta<EmpresaFila>(async (desde, hasta) => {
      const { data, error } = await supabase
        .from("empresas")
        .select("*")
        .order("nombre_comercial", { ascending: true })
        .order("id", { ascending: true })
        .range(desde, hasta);
      return { data: (data as EmpresaFila[] | null) ?? null, error };
    }),
    paginarConsulta<AsignacionFila>(async (desde, hasta) => {
      const { data, error } = await supabase
        .from("empresa_usuarios")
        .select("empresa_id, rol, es_principal")
        .eq("user_id", contexto.perfil.userId)
        .order("empresa_id", { ascending: true })
        .range(desde, hasta);
      return { data: (data as AsignacionFila[] | null) ?? null, error };
    }),
  ]);

  const asignacionPorEmpresa = new Map<string, AsignacionFila>(
    asignacionesFilas.map((asignacion) => [asignacion.empresa_id, asignacion]),
  );

  const empresas: EmpresaListado[] = [];

  for (const fila of empresasFilas) {
    const asignacion = asignacionPorEmpresa.get(fila.id);

    if (!contexto.esAdminGlobal && !asignacion) continue;

    empresas.push({
      id: fila.id,
      nombreComercial: fila.nombre_comercial,
      razonSocial: fila.razon_social,
      rnc: fila.rnc,
      tipoEmpresa: fila.tipo_empresa,
      direccion: fila.direccion,
      telefono: fila.telefono,
      correo: fila.correo,
      representanteLegal: fila.representante_legal,
      actividadEconomica: fila.actividad_economica,
      fechaInicio: fila.fecha_inicio,
      regimenFiscal: fila.regimen_fiscal,
      monedaFuncional: fila.moneda_funcional,
      periodoFiscal: fila.periodo_fiscal,
      estado: fila.estado === "inactive" ? "inactive" : "active",
      esPrincipal: asignacion?.es_principal === true,
      rol: contexto.esAdminGlobal
        ? "admin_global"
        : rolDeEmpresa(asignacion?.rol ?? "cliente"),
    });
  }

  return (
    <EmpresasVista
      empresas={empresas}
      esAdminGlobal={contexto.esAdminGlobal}
      empresaActivaId={contexto.empresaActiva?.id ?? null}
      abrirNuevaInicial={abrirNuevaInicial}
    />
  );
}
