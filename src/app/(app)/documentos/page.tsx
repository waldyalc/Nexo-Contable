import { SinEmpresaActiva } from "@/components/comunes/sin-empresa";
import {
  type DocumentoListado,
  DocumentosVista,
  type OpcionEntidad,
} from "@/components/documentos/documentos-vista";
import { obtenerContextoApp } from "@/lib/auth/sesion";
import { parametroUrl } from "@/lib/parametros";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Documentos · Nexo Contable",
};

const ENTIDADES_BASE = [
  "factura",
  "gasto",
  "pago",
  "tercero",
  "empleado",
  "activo_fijo",
  "asiento",
  "nomina",
  "conciliacion",
] as const;

interface DocumentoFila {
  id: string;
  entidad: string;
  entidad_id: string;
  nombre_archivo: string;
  ruta_storage: string;
  mime_type: string;
  tamano_bytes: number;
  creado_en: string;
}

function sanitizarEntidad(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const contexto = await obtenerContextoApp();
  const empresa = contexto.empresaActiva;

  if (!empresa) {
    return (
      <SinEmpresaActiva descripcion="Selecciona o crea una empresa para administrar sus documentos en el almacenamiento privado." />
    );
  }

  const params = await searchParams;
  const entidadParam = sanitizarEntidad(parametroUrl(params, "entidad"));
  const filtroEntidad = entidadParam;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documentos_almacenados")
    .select(
      "id, entidad, entidad_id, nombre_archivo, ruta_storage, mime_type, tamano_bytes, creado_en",
    )
    .eq("empresa_id", empresa.id)
    .like("entidad", filtroEntidad === "" ? "%" : filtroEntidad)
    .order("creado_en", { ascending: false })
    .order("id", { ascending: false })
    .range(0, 499);

  const documentosFilas: DocumentoFila[] = error
    ? []
    : ((data as DocumentoFila[] | null) ?? []);

  const documentos: DocumentoListado[] = documentosFilas.map((fila) => ({
    id: fila.id,
    entidad: fila.entidad,
    entidadId: fila.entidad_id,
    nombreArchivo: fila.nombre_archivo,
    rutaStorage: fila.ruta_storage,
    mimeType: fila.mime_type,
    tamanoBytes: Number(fila.tamano_bytes),
    creadoEn: fila.creado_en,
  }));

  const entidades = new Set<string>(ENTIDADES_BASE);
  for (const documento of documentos) entidades.add(documento.entidad);

  const opcionesEntidades: OpcionEntidad[] = [...entidades]
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((entidad) => ({ value: entidad, label: entidad }));

  const rol = contexto.rolActivo;
  const puedeEscribir =
    rol === "admin_global" ||
    rol === "admin_empresa" ||
    rol === "contador" ||
    rol === "auxiliar";

  return (
    <DocumentosVista
      empresaId={empresa.id}
      documentos={documentos}
      opcionesEntidades={opcionesEntidades}
      filtroEntidad={filtroEntidad}
      puedeEscribir={puedeEscribir}
    />
  );
}
