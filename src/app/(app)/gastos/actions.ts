"use server";

import { revalidatePath } from "next/cache";

import { MIME_EXCEL } from "@/lib/dgii/descarga";
import {
  type ContextoExportacion,
  type Fila606,
  generarExcel606,
  generarTxt606,
  nombreArchivo606,
  nombreArchivoTxt606,
} from "@/lib/dgii/exportar-606-607";
import { parsearMasivo606 } from "@/lib/dgii/parser-masivo";
import { esquemaDocumento, esquemaLote } from "@/lib/operaciones/esquemas";
import type {
  EntradaDocumento,
  ResultadoDescarga,
  ResultadoOperacion,
} from "@/lib/operaciones/tipos";
import { createClient } from "@/lib/supabase/server";

export interface ResultadoImportacion {
  creados: number;
  rechazados: { fila: number; motivo: string }[];
}

function refrescarCompras() {
  revalidatePath("/gastos");
  revalidatePath("/cuentas-por-pagar");
  revalidatePath("/impuestos");
  revalidatePath("/dashboard");
}

async function exigirSesion(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user !== null;
}

/**
 * Emite una compra o una nota de crédito de compra. El asiento contable, la
 * validación de período y el saldo del NCF los resuelve el motor en SQL:
 * nunca se envía un asiento desde la interfaz.
 */
export async function emitirDocumentoCompraAction(
  entrada: EntradaDocumento,
): Promise<ResultadoOperacion<{ id: string }>> {
  if (!(await exigirSesion())) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaDocumento.safeParse(entrada);
  if (!resultado.success) {
    return {
      ok: false,
      error:
        resultado.error.issues[0]?.message ?? "Revisa los datos del documento.",
    };
  }

  const datos = resultado.data;

  if (datos.tipo !== "purchase_invoice" && datos.tipo !== "purchase_credit") {
    return { ok: false, error: "Tipo de documento inválido para Compras." };
  }

  if (
    datos.tipo === "purchase_credit" &&
    datos.documentoAcreditadoId === null
  ) {
    return { ok: false, error: "Selecciona la compra que acredita la nota." };
  }

  if (
    datos.tipo === "purchase_invoice" &&
    datos.tipoNcf !== "" &&
    datos.ncf === ""
  ) {
    return {
      ok: false,
      error: "Escribe el NCF que corresponde al tipo de comprobante elegido.",
    };
  }

  const retenciones = datos.retencionIsr + datos.retencionItbis;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("emitir_documento_financiero", {
    p_empresa_id: datos.empresaId,
    p_tipo: datos.tipo,
    p_tercero_id: datos.terceroId,
    p_fecha_emision: datos.fechaEmision,
    p_concepto: datos.concepto,
    p_cuenta_id: datos.cuentaId,
    p_cuenta_control_id: datos.cuentaControlId,
    p_subtotal: datos.subtotal,
    p_impuesto: datos.impuesto,
    p_retenciones: retenciones,
    p_otros_impuestos: 0,
    p_tipo_ncf: datos.tipoNcf,
    p_ncf: datos.ncf,
    p_fecha_vencimiento: datos.fechaVencimiento,
    p_cuenta_impuesto_id: datos.cuentaImpuestoId,
    p_cuenta_retencion_id: datos.cuentaRetencionId,
    p_documento_acreditado_id: datos.documentoAcreditadoId,
    p_retencion_isr: datos.retencionIsr > 0 ? datos.retencionIsr : null,
    p_retencion_itbis: datos.retencionItbis > 0 ? datos.retencionItbis : null,
  });

  if (error) return { ok: false, error: error.message };
  if (typeof data !== "string") {
    return { ok: false, error: "No pudimos confirmar el documento emitido." };
  }

  refrescarCompras();
  return {
    ok: true,
    mensaje:
      datos.tipo === "purchase_invoice"
        ? "Compra registrada y contabilizada."
        : "Nota de crédito de compra registrada.",
    datos: { id: data },
  };
}

/** Carga masiva de compras desde Excel/CSV, validando cada fila antes de emitir. */
export async function importarComprasMasivasAction(entrada: {
  empresaId: string;
  nombreArchivo: string;
  archivoBase64: string;
  cuentaId: string;
  cuentaControlId: string;
  cuentaImpuestoId: string | null;
}): Promise<ResultadoOperacion<ResultadoImportacion>> {
  if (!(await exigirSesion())) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const resultado = esquemaLote.safeParse(entrada);
  if (!resultado.success) {
    return {
      ok: false,
      error: resultado.error.issues[0]?.message ?? "Revisa el archivo.",
    };
  }

  const datos = resultado.data;
  const contenido = new Uint8Array(Buffer.from(datos.archivoBase64, "base64"))
    .buffer;
  const { filas, errores } = await parsearMasivo606(
    contenido,
    datos.nombreArchivo,
  );

  const supabase = await createClient();
  const rechazados = [...errores];
  let creados = 0;

  for (const fila of filas.slice(0, 500)) {
    const { data: existente, error: errorTercero } = await supabase
      .from("terceros")
      .select("id")
      .eq("empresa_id", datos.empresaId)
      .eq("rnc_normalizado", fila.rnc)
      .maybeSingle();

    if (errorTercero) {
      rechazados.push({ fila: fila.fila, motivo: errorTercero.message });
      continue;
    }

    let terceroId: string | null =
      typeof existente === "object" && existente !== null
        ? (existente as { id: string }).id
        : null;

    if (terceroId === null) {
      const { data: nuevo, error: errorCreacion } = await supabase.rpc(
        "guardar_tercero",
        {
          p_empresa_id: datos.empresaId,
          p_tipo: "supplier",
          p_nombre: fila.nombre,
          p_rnc: fila.rnc,
        },
      );

      if (errorCreacion || typeof nuevo !== "string") {
        rechazados.push({
          fila: fila.fila,
          motivo: errorCreacion?.message ?? "No se pudo crear el proveedor.",
        });
        continue;
      }

      terceroId = nuevo;
    }

    const { error: errorEmision } = await supabase.rpc(
      "emitir_documento_financiero",
      {
        p_empresa_id: datos.empresaId,
        p_tipo: "purchase_invoice",
        p_tercero_id: terceroId,
        p_fecha_emision: fila.fechaEmision,
        p_concepto: fila.concepto,
        p_cuenta_id: datos.cuentaId,
        p_cuenta_control_id: datos.cuentaControlId,
        p_subtotal: fila.subtotal,
        p_impuesto: fila.itbis,
        p_retenciones: fila.retencionIsr + fila.retencionItbis,
        p_tipo_ncf: fila.tipoComprobante,
        p_ncf: fila.ncf,
        p_fecha_vencimiento: fila.fechaVencimiento,
        p_cuenta_impuesto_id: datos.cuentaImpuestoId,
        p_retencion_isr: fila.retencionIsr > 0 ? fila.retencionIsr : null,
        p_retencion_itbis: fila.retencionItbis > 0 ? fila.retencionItbis : null,
      },
    );

    if (errorEmision) {
      rechazados.push({ fila: fila.fila, motivo: errorEmision.message });
      continue;
    }

    creados += 1;
  }

  if (filas.length > 500) {
    rechazados.push({
      fila: 501,
      motivo: "Solo se procesan 500 filas por archivo. Divide la carga.",
    });
  }

  if (creados > 0) refrescarCompras();

  return {
    ok: true,
    mensaje:
      creados === 0
        ? "Ninguna fila se pudo cargar. Revisa los motivos."
        : `${creados} compras registradas${rechazados.length > 0 ? ` y ${rechazados.length} rechazadas` : ""}.`,
    datos: { creados, rechazados },
  };
}

interface EmpresaFila {
  rnc: string;
  razon_social: string;
}

/** Genera el archivo 606 (Excel con Incluidos + Excluidos, o TXT DGII). */
export async function exportar606Action(entrada: {
  empresaId: string;
  periodo: string;
  formato: "excel" | "txt";
}): Promise<ResultadoDescarga> {
  if (!(await exigirSesion())) {
    return { ok: false, error: "La sesión expiró. Inicia sesión de nuevo." };
  }

  const supabase = await createClient();

  const { data: empresa, error: errorEmpresa } = await supabase
    .from("empresas")
    .select("rnc, razon_social")
    .eq("id", entrada.empresaId)
    .maybeSingle();

  if (errorEmpresa || empresa === null) {
    return { ok: false, error: "No pudimos leer los datos de la empresa." };
  }

  const { data: filas, error } = await supabase.rpc("reporte_dgii_606", {
    p_empresa_id: entrada.empresaId,
    p_periodo: entrada.periodo,
  });

  if (error) return { ok: false, error: error.message };

  const datosEmpresa = empresa as EmpresaFila;
  const contexto: ContextoExportacion = {
    periodo: entrada.periodo,
    rncEmpresa: datosEmpresa.rnc,
    razonSocial: datosEmpresa.razon_social,
  };
  const registros = (filas ?? []) as Fila606[];

  if (entrada.formato === "txt") {
    return {
      ok: true,
      nombreArchivo: nombreArchivoTxt606(entrada.periodo),
      mime: "text/plain;charset=utf-8",
      contenidoBase64: Buffer.from(
        generarTxt606(registros, contexto),
        "utf-8",
      ).toString("base64"),
    };
  }

  const libro = await generarExcel606(registros, contexto);

  return {
    ok: true,
    nombreArchivo: nombreArchivo606(entrada.periodo),
    mime: MIME_EXCEL,
    contenidoBase64: Buffer.from(libro).toString("base64"),
  };
}
