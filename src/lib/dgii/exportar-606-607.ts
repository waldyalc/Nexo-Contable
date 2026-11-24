import ExcelJS from "exceljs";

/**
 * Exportadores de los formatos 606 (compras) y 607 (ventas) de la DGII.
 *
 * Regla transversal: el Excel siempre lleva **dos hojas**. La primera
 * (`Incluidos 606` / `Incluidos 607`) lista solo los registros con
 * `incluido === true` y cierra con los totales; la segunda (`Excluidos`) lista
 * los descartados con el motivo, para que el contador pueda corregirlos antes
 * de presentar el formato.
 */

export interface Fila606 {
  documento_id: string;
  tercero_id: string;
  rnc: string;
  nombre: string;
  tipo_identificacion: string;
  tipo_comprobante: string;
  ncf: string;
  fecha_comprobante: string;
  fecha_pago: string;
  monto_facturado: number;
  base_imponible: number;
  itbis_facturado: number;
  retencion_isr: number;
  retencion_itbis: number;
  total_retenido: number;
  incluido: boolean;
  motivo_exclusion: string;
}

export interface Fila607 {
  documento_id: string;
  tercero_id: string;
  rnc: string;
  nombre: string;
  tipo_identificacion: string;
  tipo_comprobante: string;
  ncf: string;
  fecha_comprobante: string;
  monto_facturado: number;
  base_imponible: number;
  itbis_facturado: number;
  itbis_retenido: number;
  retencion_renta: number;
  otros_impuestos: number;
  total: number;
  metodo_pago: string;
  incluido: boolean;
  motivo_exclusion: string;
}

export interface ContextoExportacion {
  /** Periodo fiscal en `YYYY-MM` o `YYYYMM`. */
  periodo: string;
  /** RNC de la empresa que presenta el formato. */
  rncEmpresa: string;
  /** Razón social de la empresa; solo se usa como metadato del Excel. */
  razonSocial: string;
}

export const NOMBRE_HOJA_INCLUIDOS_606 = "Incluidos 606";
export const NOMBRE_HOJA_INCLUIDOS_607 = "Incluidos 607";
export const NOMBRE_HOJA_EXCLUIDOS = "Excluidos";

/** Normaliza un periodo a `YYYYMM`, el formato que exige la DGII. */
export function periodoDgii(periodo: string): string {
  const limpio = periodo.replace(/\D/g, "");
  return limpio.length === 6 ? limpio : limpio.slice(0, 6);
}

/** Fecha `yyyy-MM-dd` (o ISO) a `AAAAMMDD`; vacía si no es válida. */
export function fechaDgii(fecha: string): string {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha.trim());
  if (!coincidencia) return "";
  const [, anio, mes, dia] = coincidencia;
  if (!anio || !mes || !dia) return "";
  return `${anio}${mes}${dia}`;
}

/** Monto con dos decimales y punto decimal, sin separadores de miles. */
export function montoDgii(monto: number): string {
  const numero = Number.isFinite(monto) ? monto : 0;
  return numero.toFixed(2);
}

export function nombreArchivo606(periodo: string): string {
  return `606_${periodoDgii(periodo)}.xlsx`;
}

export function nombreArchivo607(periodo: string): string {
  return `607_${periodoDgii(periodo)}.xlsx`;
}

export function nombreArchivoTxt606(periodo: string): string {
  return `DGII_606_${periodoDgii(periodo)}.TXT`;
}

export function nombreArchivoTxt607(periodo: string): string {
  return `DGII_607_${periodoDgii(periodo)}.TXT`;
}

function sumar<T>(filas: readonly T[], obtener: (fila: T) => number): number {
  return filas.reduce((total, fila) => total + obtener(fila), 0);
}

function crearLibro(contexto: ContextoExportacion, formato: "606" | "607") {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Nexo Contable";
  libro.created = new Date();
  libro.title = `Formato ${formato} · ${periodoDgii(contexto.periodo)}`;
  libro.subject = `${contexto.razonSocial} · RNC ${contexto.rncEmpresa}`;
  return libro;
}

function agregarFilaTotales(
  hoja: ExcelJS.Worksheet,
  etiqueta: string,
  columnas: { columna: number; total: number }[],
) {
  const fila = hoja.addRow([]);
  fila.font = { bold: true };
  hoja.getCell(fila.number, 1).value = etiqueta;
  hoja.getCell(fila.number, 1).font = { bold: true };

  for (const { columna, total } of columnas) {
    const celda = hoja.getCell(fila.number, columna);
    celda.value = total;
    celda.numFmt = "#,##0.00";
    celda.font = { bold: true };
  }
}

function estiloEncabezado(hoja: ExcelJS.Worksheet) {
  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
  encabezado.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF176B53" },
  };
  encabezado.alignment = { vertical: "middle" };
  hoja.views = [{ state: "frozen", ySplit: 1 }];
}

/** Genera el Excel del 606 con las hojas obligatorias de incluidos y excluidos. */
export async function generarExcel606(
  filas: readonly Fila606[],
  contexto: ContextoExportacion,
): Promise<ArrayBuffer> {
  const libro = crearLibro(contexto, "606");
  const incluidos = filas.filter((fila) => fila.incluido);
  const excluidos = filas.filter((fila) => !fila.incluido);

  const hojaIncluidos = libro.addWorksheet(NOMBRE_HOJA_INCLUIDOS_606);
  hojaIncluidos.columns = [
    { header: "RNC / Cédula", key: "rnc", width: 18 },
    { header: "Tercero", key: "nombre", width: 34 },
    { header: "Tipo comprobante", key: "tipo_comprobante", width: 18 },
    { header: "NCF", key: "ncf", width: 18 },
    { header: "Fecha comprobante", key: "fecha_comprobante", width: 18 },
    { header: "Fecha pago", key: "fecha_pago", width: 14 },
    { header: "Monto facturado", key: "monto_facturado", width: 18 },
    { header: "Base imponible", key: "base_imponible", width: 17 },
    { header: "ITBIS facturado", key: "itbis_facturado", width: 17 },
    { header: "Retención ISR", key: "retencion_isr", width: 15 },
    { header: "Retención ITBIS", key: "retencion_itbis", width: 16 },
    { header: "Total retenido", key: "total_retenido", width: 15 },
  ];

  for (const fila of incluidos) {
    hojaIncluidos.addRow({
      rnc: fila.rnc,
      nombre: fila.nombre,
      tipo_comprobante: fila.tipo_comprobante,
      ncf: fila.ncf,
      fecha_comprobante: fechaDgii(fila.fecha_comprobante),
      fecha_pago: fechaDgii(fila.fecha_pago),
      monto_facturado: fila.monto_facturado,
      base_imponible: fila.base_imponible,
      itbis_facturado: fila.itbis_facturado,
      retencion_isr: fila.retencion_isr,
      retencion_itbis: fila.retencion_itbis,
      total_retenido: fila.total_retenido,
    });
  }

  for (const columna of [7, 8, 9, 10, 11, 12]) {
    hojaIncluidos.getColumn(columna).numFmt = "#,##0.00";
  }

  estiloEncabezado(hojaIncluidos);

  agregarFilaTotales(hojaIncluidos, `Total ${incluidos.length} registros`, [
    { columna: 7, total: sumar(incluidos, (fila) => fila.monto_facturado) },
    { columna: 8, total: sumar(incluidos, (fila) => fila.base_imponible) },
    { columna: 9, total: sumar(incluidos, (fila) => fila.itbis_facturado) },
    { columna: 10, total: sumar(incluidos, (fila) => fila.retencion_isr) },
    { columna: 11, total: sumar(incluidos, (fila) => fila.retencion_itbis) },
    { columna: 12, total: sumar(incluidos, (fila) => fila.total_retenido) },
  ]);

  const hojaExcluidos = libro.addWorksheet(NOMBRE_HOJA_EXCLUIDOS);
  hojaExcluidos.columns = [
    { header: "Documento", key: "documento", width: 38 },
    { header: "Tercero", key: "nombre", width: 34 },
    { header: "RNC / Cédula", key: "rnc", width: 18 },
    { header: "NCF", key: "ncf", width: 18 },
    { header: "Monto", key: "monto", width: 18 },
    { header: "Motivo de exclusión", key: "motivo_exclusion", width: 46 },
  ];

  for (const fila of excluidos) {
    hojaExcluidos.addRow({
      documento: fila.documento_id,
      nombre: fila.nombre,
      rnc: fila.rnc,
      ncf: fila.ncf,
      monto: fila.monto_facturado,
      motivo_exclusion:
        fila.motivo_exclusion === ""
          ? "Sin motivo indicado"
          : fila.motivo_exclusion,
    });
  }

  hojaExcluidos.getColumn(5).numFmt = "#,##0.00";
  estiloEncabezado(hojaExcluidos);

  const contenido = await libro.xlsx.writeBuffer();
  return contenido;
}

/** Genera el Excel del 607 con las hojas obligatorias de incluidos y excluidos. */
export async function generarExcel607(
  filas: readonly Fila607[],
  contexto: ContextoExportacion,
): Promise<ArrayBuffer> {
  const libro = crearLibro(contexto, "607");
  const incluidos = filas.filter((fila) => fila.incluido);
  const excluidos = filas.filter((fila) => !fila.incluido);

  const hojaIncluidos = libro.addWorksheet(NOMBRE_HOJA_INCLUIDOS_607);
  hojaIncluidos.columns = [
    { header: "RNC / Cédula", key: "rnc", width: 18 },
    { header: "Tercero", key: "nombre", width: 34 },
    { header: "Tipo comprobante", key: "tipo_comprobante", width: 18 },
    { header: "NCF", key: "ncf", width: 18 },
    { header: "Fecha comprobante", key: "fecha_comprobante", width: 18 },
    { header: "Monto facturado", key: "monto_facturado", width: 18 },
    { header: "Base imponible", key: "base_imponible", width: 17 },
    { header: "ITBIS facturado", key: "itbis_facturado", width: 17 },
    { header: "ITBIS retenido", key: "itbis_retenido", width: 16 },
    { header: "Retención renta", key: "retencion_renta", width: 16 },
    { header: "Otros impuestos", key: "otros_impuestos", width: 16 },
    { header: "Total", key: "total", width: 18 },
    { header: "Método de pago", key: "metodo_pago", width: 18 },
  ];

  for (const fila of incluidos) {
    hojaIncluidos.addRow({
      rnc: fila.rnc,
      nombre: fila.nombre,
      tipo_comprobante: fila.tipo_comprobante,
      ncf: fila.ncf,
      fecha_comprobante: fechaDgii(fila.fecha_comprobante),
      monto_facturado: fila.monto_facturado,
      base_imponible: fila.base_imponible,
      itbis_facturado: fila.itbis_facturado,
      itbis_retenido: fila.itbis_retenido,
      retencion_renta: fila.retencion_renta,
      otros_impuestos: fila.otros_impuestos,
      total: fila.total,
      metodo_pago: fila.metodo_pago,
    });
  }

  for (const columna of [6, 7, 8, 9, 10, 11, 12]) {
    hojaIncluidos.getColumn(columna).numFmt = "#,##0.00";
  }

  estiloEncabezado(hojaIncluidos);

  agregarFilaTotales(hojaIncluidos, `Total ${incluidos.length} registros`, [
    { columna: 6, total: sumar(incluidos, (fila) => fila.monto_facturado) },
    { columna: 7, total: sumar(incluidos, (fila) => fila.base_imponible) },
    { columna: 8, total: sumar(incluidos, (fila) => fila.itbis_facturado) },
    { columna: 9, total: sumar(incluidos, (fila) => fila.itbis_retenido) },
    { columna: 10, total: sumar(incluidos, (fila) => fila.retencion_renta) },
    { columna: 11, total: sumar(incluidos, (fila) => fila.otros_impuestos) },
    { columna: 12, total: sumar(incluidos, (fila) => fila.total) },
  ]);

  const hojaExcluidos = libro.addWorksheet(NOMBRE_HOJA_EXCLUIDOS);
  hojaExcluidos.columns = [
    { header: "Documento", key: "documento", width: 38 },
    { header: "Tercero", key: "nombre", width: 34 },
    { header: "RNC / Cédula", key: "rnc", width: 18 },
    { header: "NCF", key: "ncf", width: 18 },
    { header: "Monto", key: "monto", width: 18 },
    { header: "Motivo de exclusión", key: "motivo_exclusion", width: 46 },
  ];

  for (const fila of excluidos) {
    hojaExcluidos.addRow({
      documento: fila.documento_id,
      nombre: fila.nombre,
      rnc: fila.rnc,
      ncf: fila.ncf,
      monto: fila.monto_facturado,
      motivo_exclusion:
        fila.motivo_exclusion === ""
          ? "Sin motivo indicado"
          : fila.motivo_exclusion,
    });
  }

  hojaExcluidos.getColumn(5).numFmt = "#,##0.00";
  estiloEncabezado(hojaExcluidos);

  const contenido = await libro.xlsx.writeBuffer();
  return contenido;
}

/**
 * TXT oficial del 606: cabecera `606|RNC|AAAAMM|CANTIDAD` y una línea por
 * comprobante incluido con los campos separados por `|`.
 */
export function generarTxt606(
  filas: readonly Fila606[],
  contexto: ContextoExportacion,
): string {
  const incluidos = filas.filter((fila) => fila.incluido);
  const lineas: string[] = [
    [
      "606",
      periodoRnc(contexto),
      periodoDgii(contexto.periodo),
      String(incluidos.length),
    ].join("|"),
  ];

  for (const fila of incluidos) {
    lineas.push(
      [
        fila.tipo_identificacion === ""
          ? tipoIdentificacion(fila.rnc)
          : fila.tipo_identificacion,
        fila.rnc,
        fila.tipo_comprobante,
        fila.ncf,
        fechaDgii(fila.fecha_comprobante),
        fechaDgii(fila.fecha_pago),
        montoDgii(fila.monto_facturado),
        montoDgii(fila.itbis_facturado),
        montoDgii(fila.retencion_itbis),
        montoDgii(0),
        montoDgii(0),
        montoDgii(0),
        montoDgii(0),
        montoDgii(fila.retencion_isr),
        montoDgii(0),
        montoDgii(0),
        montoDgii(0),
        montoDgii(fila.retencion_itbis),
        montoDgii(fila.retencion_isr),
      ].join("|"),
    );
  }

  return `${lineas.join("\r\n")}\r\n`;
}

/**
 * TXT oficial del 607: cabecera `607|RNC|AAAAMM|CANTIDAD` y una línea por
 * comprobante incluido con los campos separados por `|`.
 */
export function generarTxt607(
  filas: readonly Fila607[],
  contexto: ContextoExportacion,
): string {
  const incluidos = filas.filter((fila) => fila.incluido);
  const lineas: string[] = [
    [
      "607",
      periodoRnc(contexto),
      periodoDgii(contexto.periodo),
      String(incluidos.length),
    ].join("|"),
  ];

  for (const fila of incluidos) {
    lineas.push(
      [
        fila.tipo_identificacion === ""
          ? tipoIdentificacion(fila.rnc)
          : fila.tipo_identificacion,
        fila.rnc,
        fila.ncf,
        fechaDgii(fila.fecha_comprobante),
        montoDgii(fila.monto_facturado),
        montoDgii(fila.itbis_facturado),
        montoDgii(fila.itbis_retenido),
        montoDgii(0),
        montoDgii(fila.retencion_renta),
        montoDgii(0),
        montoDgii(0),
        montoDgii(fila.otros_impuestos),
        montoDgii(fila.total),
      ].join("|"),
    );
  }

  return `${lineas.join("\r\n")}\r\n`;
}

function periodoRnc(contexto: ContextoExportacion): string {
  return contexto.rncEmpresa.replace(/\D/g, "");
}

/** La DGII usa 1 = RNC y 2 = Cédula. */
function tipoIdentificacion(rnc: string): string {
  return rnc.replace(/\D/g, "").length === 11 ? "2" : "1";
}
