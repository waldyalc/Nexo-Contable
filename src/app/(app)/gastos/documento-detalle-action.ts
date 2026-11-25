"use server";

import { z } from "zod";

import {
  type ResultadoDocumentoDetalle,
  cargarDocumentoDetalle,
} from "@/lib/operaciones/consultas";
import { createClient } from "@/lib/supabase/server";

const esquemaEntrada = z.object({
  empresaId: z.string().uuid("Empresa inválida."),
  documentoId: z.string().uuid("Documento inválido."),
});

async function exigirSesion(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user !== null;
}

function mensajeError(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return "No pudimos cargar el detalle del documento.";
}

export async function cargarDocumentoDetalleGastosAction(
  empresaId: string,
  documentoId: string,
): Promise<ResultadoDocumentoDetalle> {
  if (!(await exigirSesion())) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const entrada = esquemaEntrada.safeParse({ empresaId, documentoId });
  if (!entrada.success) {
    return {
      ok: false,
      error: entrada.error.issues[0]?.message ?? "Documento inválido.",
    };
  }

  try {
    const detalle = await cargarDocumentoDetalle(
      entrada.data.empresaId,
      entrada.data.documentoId,
    );

    if (
      detalle.documento.tipo !== "purchase_invoice" &&
      detalle.documento.tipo !== "purchase_credit"
    ) {
      return { ok: false, error: "Documento inválido para Gastos y compras." };
    }

    return { ok: true, detalle };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
