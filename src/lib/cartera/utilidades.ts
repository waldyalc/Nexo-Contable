import type {
  DocumentoListado,
  PagoListado,
  TerceroListado,
} from "@/lib/operaciones/tipos";

export type TipoCartera = "cxc" | "cxp";

export interface EstadoDocumentoCartera {
  clave: string;
  etiqueta: string;
}

export interface PagoCarteraListado extends PagoListado {
  documento: DocumentoListado;
  terceroRnc: string;
}

/** Estado visible del documento, equivalente al `dueState` del Nexo original. */
export function estadoDocumentoCartera(
  documento: Pick<DocumentoListado, "estado" | "estadoCobro">,
): EstadoDocumentoCartera {
  if (documento.estado === "draft") {
    return { clave: "borrador", etiqueta: "Borrador" };
  }
  if (documento.estado === "void") {
    return { clave: "anulada", etiqueta: "Anulada" };
  }
  if (documento.estadoCobro === "saldada") {
    return { clave: "saldada", etiqueta: "Saldada" };
  }
  if (documento.estadoCobro === "vencida") {
    return { clave: "vencida", etiqueta: "Vencida" };
  }
  return { clave: "pendiente", etiqueta: "Pendiente" };
}

/** Clientes para CxC o suplidores para CxP; los terceros `both` aplican a ambos. */
export function tercerosDeCartera(
  terceros: readonly TerceroListado[],
  tipo: TipoCartera,
): TerceroListado[] {
  const tipoBase = tipo === "cxc" ? "customer" : "supplier";
  return terceros.filter(
    (tercero) => tercero.tipo === tipoBase || tercero.tipo === "both",
  );
}

/** Enriquece cobros/pagos con el documento y el RNC sin mezclar el ciclo contrario. */
export function enriquecerPagosCartera(
  pagos: readonly PagoListado[],
  documentos: readonly DocumentoListado[],
  rncPorTercero: Readonly<Record<string, string>>,
): PagoCarteraListado[] {
  const documentoPorId = new Map(
    documentos.map((documento) => [documento.id, documento]),
  );

  return pagos.flatMap((pago) => {
    const documento = documentoPorId.get(pago.documentoId);
    if (!documento) return [];

    return [
      {
        ...pago,
        documento,
        terceroRnc: rncPorTercero[documento.terceroId] ?? "",
      },
    ];
  });
}

/** Último número de factura usado, con orden natural (`FAC-9` antes de `FAC-10`). */
export function ultimaFacturaCartera(
  documentos: readonly DocumentoListado[],
  tipoFactura: DocumentoListado["tipo"],
): DocumentoListado | null {
  const facturas = documentos.filter(
    (documento) => documento.tipo === tipoFactura,
  );
  const ordenadas = [...facturas].sort((a, b) =>
    b.numero.localeCompare(a.numero, "es", { numeric: true }),
  );
  return ordenadas[0] ?? null;
}
