import { NextResponse } from "next/server";

import {
  MENSAJES_DGII,
  type TipoDocumentoDgii,
  consultarDgii,
  tipoDocumentoPorLongitud,
  validarDocumentoDgii,
} from "@/lib/dgii/consulta";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dgii/rnc?numero=130893489[&tipo=rnc|cedula]
 *
 * Consulta el padrón de la DGII para autocompletar la razón social de un
 * tercero. Exige sesión: es un proxy para el portal de la DGII, no un endpoint
 * público de datos.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_autorizado",
        mensaje: "Inicia sesión para consultar el padrón de la DGII.",
      },
      { status: 401 },
    );
  }

  const parametros = new URL(request.url).searchParams;
  const numero = parametros.get("numero") ?? "";
  const tipoParametro = parametros.get("tipo");

  const tipo: TipoDocumentoDgii | null =
    tipoParametro === "rnc" || tipoParametro === "cedula"
      ? tipoParametro
      : tipoDocumentoPorLongitud(numero);

  if (tipo === null) {
    return NextResponse.json(
      {
        ok: false,
        error: "documento_invalido",
        mensaje: MENSAJES_DGII.documento_invalido,
      },
      { status: 400 },
    );
  }

  const validacion = validarDocumentoDgii(tipo, numero);

  if (!validacion.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "documento_invalido",
        mensaje: MENSAJES_DGII.documento_invalido,
      },
      { status: 400 },
    );
  }

  const resultado = await consultarDgii(tipo, validacion.numero);

  if (!resultado.ok) {
    return NextResponse.json({
      ok: false,
      error: resultado.error,
      mensaje: MENSAJES_DGII[resultado.error],
    });
  }

  return NextResponse.json({ ok: true, datos: resultado.datos });
}
