"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type ResultadoDocumentos =
  | { ok: true; mensaje: string }
  | { ok: false; error: string };

export interface DatosDocumento {
  empresaId: string;
  entidad: string;
  entidadId: string;
  nombreArchivo: string;
  rutaStorage: string;
  mimeType: string;
  tamanoBytes: number;
}

export interface DatosEliminarDocumento {
  empresaId: string;
  documentoId: string;
  rutaStorage: string;
}

const identificador = z.string().uuid("Identificador inválido.");
const texto = (max: number) =>
  z.string().trim().max(max, `Máximo ${max} caracteres.`);

const esquemaDocumento = z.object({
  empresaId: identificador,
  entidad: z
    .string()
    .trim()
    .min(1, "Indica la entidad del documento.")
    .max(60, "Máximo 60 caracteres."),
  entidadId: texto(120),
  nombreArchivo: z
    .string()
    .trim()
    .min(1, "El nombre del archivo es obligatorio.")
    .max(200, "Máximo 200 caracteres."),
  rutaStorage: z
    .string()
    .trim()
    .min(1, "La ruta del archivo es obligatoria.")
    .max(400, "Máximo 400 caracteres."),
  mimeType: texto(120),
  tamanoBytes: z
    .number()
    .int("Tamaño inválido.")
    .nonnegative("El tamaño no puede ser negativo."),
});

const esquemaEliminar = z.object({
  empresaId: identificador,
  documentoId: identificador,
  rutaStorage: z
    .string()
    .trim()
    .min(1, "La ruta del archivo es obligatoria.")
    .max(400, "Máximo 400 caracteres."),
});

async function exigirSesion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return supabase;
}

function primerError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Revisa los datos enviados.";
}

function refrescar() {
  revalidatePath("/documentos");
}

export async function registrarDocumentoAction(
  datos: DatosDocumento,
): Promise<ResultadoDocumentos> {
  const supabase = await exigirSesion();
  if (!supabase) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaDocumento.safeParse(datos);
  if (!resultado.success) {
    return { ok: false, error: primerError(resultado.error) };
  }

  const documento = resultado.data;

  if (!documento.rutaStorage.startsWith(`${documento.empresaId}/`)) {
    return {
      ok: false,
      error: "La ruta del archivo debe iniciar con la empresa activa.",
    };
  }

  const { error } = await supabase.rpc("registrar_documento_almacenado", {
    p_empresa_id: documento.empresaId,
    p_entidad: documento.entidad,
    p_entidad_id: documento.entidadId,
    p_nombre_archivo: documento.nombreArchivo,
    p_ruta_storage: documento.rutaStorage,
    p_mime_type: documento.mimeType,
    p_tamano_bytes: documento.tamanoBytes,
  });

  if (error) return { ok: false, error: error.message };

  refrescar();

  return { ok: true, mensaje: "Documento registrado correctamente." };
}

export async function eliminarDocumentoAction(
  datos: DatosEliminarDocumento,
): Promise<ResultadoDocumentos> {
  const supabase = await exigirSesion();
  if (!supabase) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaEliminar.safeParse(datos);
  if (!resultado.success) {
    return { ok: false, error: primerError(resultado.error) };
  }

  const documento = resultado.data;

  const { error: errorStorage } = await supabase.storage
    .from("documentos")
    .remove([documento.rutaStorage]);

  if (errorStorage) {
    return {
      ok: false,
      error: `No pudimos quitar el archivo del almacenamiento: ${errorStorage.message}`,
    };
  }

  const { error } = await supabase.rpc("eliminar_documento_almacenado", {
    p_empresa_id: documento.empresaId,
    p_documento_id: documento.documentoId,
  });

  if (error) return { ok: false, error: error.message };

  refrescar();

  return { ok: true, mensaje: "Documento eliminado." };
}
