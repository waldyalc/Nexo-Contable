import { redirect } from "next/navigation";

import {
  type AuditoriaRegistro,
  AuditoriaVista,
} from "@/components/auditoria/auditoria-vista";
import { SinEmpresaActiva } from "@/components/comunes/sin-empresa";
import { obtenerContextoApp } from "@/lib/auth/sesion";
import { esFecha, fechaOFecha, parametroUrl } from "@/lib/parametros";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Auditoría · Nexo Contable",
};

const POR_PAGINA = 50;

interface AuditoriaFila {
  id: number;
  actor_id: string | null;
  accion: string;
  entidad: string;
  entidad_id: string;
  detalles: unknown;
  creado_en: string;
}

interface EntidadFila {
  entidad: string;
}

interface PerfilFila {
  user_id: string;
  nombre: string;
  email: string;
}

function sanearBusqueda(valor: string): string {
  return valor
    .trim()
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 60);
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const contexto = await obtenerContextoApp();
  const rol = contexto.rolActivo;

  if (rol !== "admin_global" && rol !== "admin_empresa") {
    redirect("/dashboard");
  }

  const empresa = contexto.empresaActiva;

  if (!empresa) {
    return (
      <SinEmpresaActiva descripcion="Selecciona o crea una empresa para consultar su auditoría." />
    );
  }

  const params = await searchParams;
  const desdeParam = parametroUrl(params, "desde");
  const hastaParam = parametroUrl(params, "hasta");
  const entidadParam = parametroUrl(params, "entidad");
  const busquedaParam = sanearBusqueda(parametroUrl(params, "q"));
  const paginaParam = Number.parseInt(parametroUrl(params, "pagina"), 10);

  const desde = esFecha(desdeParam) ? desdeParam : "";
  const hasta = esFecha(hastaParam) ? hastaParam : "";
  const entidad = entidadParam.replace(/[^a-z0-9._-]/gi, "").slice(0, 60);
  const busqueda = busquedaParam;
  const pagina =
    Number.isFinite(paginaParam) && paginaParam > 0 ? paginaParam : 1;

  const desdeFiltro = fechaOFecha(desde, "1900-01-01") ?? "1900-01-01";
  const hastaFiltro = fechaOFecha(hasta, "2999-12-31") ?? "2999-12-31";
  const patronEntidad = entidad === "" ? "%" : `${entidad}%`;
  const patronBusqueda =
    busqueda === ""
      ? "id.gt.0"
      : `accion.ilike.%${busqueda}%,entidad.ilike.%${busqueda}%,entidad_id.ilike.%${busqueda}%`;

  const supabase = await createClient();

  const desdeRegistro = (pagina - 1) * POR_PAGINA;

  const [registrosConsulta, conteoConsulta, entidadesConsulta, perfiles] =
    await Promise.all([
      supabase
        .from("auditoria")
        .select(
          "id, actor_id, accion, entidad, entidad_id, detalles, creado_en",
        )
        .eq("empresa_id", empresa.id)
        .gte("creado_en", desdeFiltro)
        .lte("creado_en", hastaFiltro)
        .like("entidad", patronEntidad)
        .or(patronBusqueda)
        .order("creado_en", { ascending: false })
        .order("id", { ascending: false })
        .range(desdeRegistro, desdeRegistro + POR_PAGINA - 1),
      supabase
        .from("auditoria")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresa.id)
        .gte("creado_en", desdeFiltro)
        .lte("creado_en", hastaFiltro)
        .like("entidad", patronEntidad)
        .or(patronBusqueda),
      supabase
        .from("auditoria")
        .select("entidad")
        .eq("empresa_id", empresa.id)
        .order("creado_en", { ascending: false })
        .range(0, 999),
      paginarConsulta<PerfilFila>(async (desdeRango, hastaRango) => {
        const { data, error } = await supabase
          .from("perfiles")
          .select("user_id, nombre, email")
          .order("user_id", { ascending: true })
          .range(desdeRango, hastaRango);
        return { data: (data as PerfilFila[] | null) ?? null, error };
      }),
    ]);

  const registrosFilas =
    (registrosConsulta.data as AuditoriaFila[] | null) ?? [];
  const registros: AuditoriaRegistro[] = registrosFilas.map((fila) => ({
    id: fila.id,
    actorId: fila.actor_id,
    accion: fila.accion,
    entidad: fila.entidad,
    entidadId: fila.entidad_id,
    detalles: fila.detalles,
    creadoEn: fila.creado_en,
  }));

  const total = conteoConsulta.count ?? registrosFilas.length;
  const totalPaginas = Math.max(Math.ceil(total / POR_PAGINA), 1);

  const entidades = new Set<string>();
  const entidadesFilas = (entidadesConsulta.data as EntidadFila[] | null) ?? [];
  for (const fila of entidadesFilas) entidades.add(fila.entidad);
  if (entidad !== "") entidades.add(entidad);

  const actores: Record<string, string> = {};
  for (const perfil of perfiles) {
    actores[perfil.user_id] =
      perfil.nombre.trim() === "" ? perfil.email : perfil.nombre;
  }

  return (
    <AuditoriaVista
      registros={registros}
      actores={actores}
      entidades={[...entidades].sort((a, b) => a.localeCompare(b, "es"))}
      filtros={{ desde, hasta, entidad, busqueda }}
      paginacion={{ pagina, totalPaginas, total }}
    />
  );
}
