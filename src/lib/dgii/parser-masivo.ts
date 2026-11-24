import ExcelJS from "exceljs";

import { normalizarRnc } from "@/lib/formato";

/**
 * Parser de carga masiva de comprobantes (606 compras / 607 ventas).
 *
 * Acepta Excel (`.xlsx`) y CSV (`,` `;` o tabulador) y valida cada fila antes
 * de devolverla: RNC/Cédula de 9 u 11 dígitos, tipo de comprobante de la DGII
 * (`B01`–`B17` y `E31`–`E47`), NCF con longitud correcta, fecha real y montos
 * no negativos. Las filas inválidas no se emiten: vuelven en `errores` con el
 * número de fila y el motivo, para que el usuario corrija el archivo.
 */

export interface FilaMasivaCompra {
  fila: number;
  rnc: string;
  nombre: string;
  tipoComprobante: string;
  ncf: string;
  fechaEmision: string;
  fechaVencimiento: string | null;
  concepto: string;
  subtotal: number;
  itbis: number;
  retencionIsr: number;
  retencionItbis: number;
}

export interface FilaMasivaVenta {
  fila: number;
  rnc: string;
  nombre: string;
  /** Vacío = consumir la secuencia NCF activa de la empresa. */
  tipoComprobante: string;
  /** Vacío = consumir la secuencia NCF activa de la empresa. */
  ncf: string;
  fechaEmision: string;
  fechaVencimiento: string | null;
  concepto: string;
  subtotal: number;
  itbis: number;
}

export interface ErrorFilaMasiva {
  fila: number;
  motivo: string;
}

export interface ResultadoParseoMasivo<T> {
  filas: T[];
  errores: ErrorFilaMasiva[];
}

const PATRON_TIPO_COMPROBANTE = /^(B(0[1-9]|1[0-7])|E(3[1-9]|4[0-7]))$/;
const PATRON_NCF = /^(B(0[1-9]|1[0-7])[0-9]{8}|E(3[1-9]|4[0-7])[0-9]{10})$/;

type FilaCruda = Record<string, string>;

type CampoAlias =
  | "rnc"
  | "nombre"
  | "tipoComprobante"
  | "ncf"
  | "fechaEmision"
  | "fechaVencimiento"
  | "concepto"
  | "subtotal"
  | "itbis"
  | "retencionIsr"
  | "retencionItbis";

const ALIAS: Record<CampoAlias, readonly string[]> = {
  rnc: [
    "rnc",
    "rnc/cedula",
    "rnc cedula",
    "cedula",
    "identificacion",
    "documento",
  ],
  nombre: [
    "nombre",
    "tercero",
    "proveedor",
    "cliente",
    "razon social",
    "nombre tercero",
  ],
  tipoComprobante: [
    "tipo comprobante",
    "tipo_comprobante",
    "tipo ncf",
    "tipo_ncf",
    "comprobante",
  ],
  ncf: ["ncf", "ncf comprobante", "comprobante fiscal", "numero comprobante"],
  fechaEmision: [
    "fecha",
    "fecha emision",
    "fecha_emision",
    "fecha comprobante",
    "fecha_comprobante",
  ],
  fechaVencimiento: ["vencimiento", "fecha vencimiento", "fecha_vencimiento"],
  concepto: ["concepto", "descripcion", "detalle", "glosa"],
  subtotal: [
    "subtotal",
    "monto",
    "base imponible",
    "monto facturado",
    "monto_facturado",
    "importe",
  ],
  itbis: [
    "itbis",
    "impuesto",
    "itbis facturado",
    "itbis_facturado",
    "itbis trasladado",
  ],
  retencionIsr: ["retencion isr", "retencion_isr", "isr", "renta retenida"],
  retencionItbis: ["retencion itbis", "retencion_itbis", "itbis retenido"],
};

function normalizarClave(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function valorDe(fila: FilaCruda, campo: CampoAlias): string {
  for (const alias of ALIAS[campo]) {
    const valor = fila[normalizarClave(alias)];
    if (valor !== undefined && valor !== "") return valor;
  }
  return "";
}

/** Convierte `RD$ 1,250.00` o `1250,00` en número; los inválidos valen 0. */
export function aMontoMasivo(valor: string): number {
  if (valor.trim() === "") return 0;
  const limpio = valor.replace(/[^\d.,-]/g, "");
  const conPunto =
    limpio.includes(",") && !limpio.includes(".")
      ? limpio.replace(/,/g, ".")
      : limpio.replace(/,/g, "");
  const numero = Number(conPunto);
  return Number.isFinite(numero) ? numero : 0;
}

/** Normaliza la fecha a `yyyy-MM-dd`; admite serial de Excel. */
export function fechaMasiva(valor: string): string | null {
  const limpio = valor.trim();
  if (limpio === "") return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(limpio);
  if (iso) {
    const [, anio, mes, dia] = iso;
    if (!anio || !mes || !dia) return null;
    return `${anio}-${mes}-${dia}`;
  }

  const local = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(limpio);
  if (local) {
    const [, dia, mes, anio] = local;
    if (!dia || !mes || !anio) return null;
    return `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
  }

  if (/^\d{5}$/.test(limpio)) {
    const dias = Number(limpio);
    const base = Date.UTC(1899, 11, 30);
    const fecha = new Date(base + dias * 86_400_000);
    if (Number.isNaN(fecha.getTime())) return null;
    return fecha.toISOString().slice(0, 10);
  }

  return null;
}

function textoCelda(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === "object") {
    if ("richText" in valor && Array.isArray(valor.richText)) {
      return valor.richText.map((parte) => parte.text).join("");
    }
    if ("text" in valor && typeof valor.text === "string") return valor.text;
    if ("result" in valor) {
      const resultado: ExcelJS.CellValue | undefined = valor.result;
      return resultado === undefined ? "" : textoCelda(resultado);
    }
    if ("error" in valor) return "";
  }
  return String(valor);
}

function separarCsv(texto: string): string[][] {
  const lineas = texto
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((linea) => linea.trim() !== "");
  const primera = lineas[0] ?? "";
  const delimitador = [";", ",", "\t"].reduce(
    (mejor, candidato) =>
      primera.split(candidato).length > primera.split(mejor).length
        ? candidato
        : mejor,
    ";",
  );

  return lineas.map((linea) => {
    const celdas: string[] = [];
    let actual = "";
    let entreComillas = false;

    for (const caracter of linea) {
      if (caracter === '"') {
        entreComillas = !entreComillas;
        continue;
      }
      if (caracter === delimitador && !entreComillas) {
        celdas.push(actual.trim());
        actual = "";
        continue;
      }
      actual += caracter;
    }

    celdas.push(actual.trim());
    return celdas;
  });
}

async function leerFilas(
  contenido: ArrayBuffer,
  nombreArchivo: string,
): Promise<FilaCruda[]> {
  const esCsv = /\.csv$/i.test(nombreArchivo);
  let matriz: string[][];

  if (esCsv) {
    matriz = separarCsv(new TextDecoder().decode(contenido));
  } else {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(contenido);
    const hoja = libro.worksheets[0];
    if (!hoja) return [];

    const filas: string[][] = [];
    hoja.eachRow({ includeEmpty: false }, (fila) => {
      const celdas: string[] = [];
      fila.eachCell({ includeEmpty: true }, (celda) => {
        celdas.push(textoCelda(celda.value));
      });
      filas.push(celdas);
    });
    matriz = filas;
  }

  const encabezados = (matriz[0] ?? []).map(normalizarClave);
  if (encabezados.length === 0) return [];

  return matriz.slice(1).map((celdas) => {
    const fila: FilaCruda = {};
    encabezados.forEach((encabezado, indice) => {
      if (encabezado === "") return;
      fila[encabezado] = celdas[indice] ?? "";
    });
    return fila;
  });
}

/**
 * Valida el núcleo común de una fila y devuelve el motivo del rechazo.
 * `exigirNcf` distingue compras (NCF del proveedor obligatorio) de ventas
 * (NCF opcional: lo emite la secuencia de la empresa).
 */
function validarFila(
  fila: FilaCruda,
  exigirNcf: boolean,
): { ok: true; datos: FilaMasivaCompra } | { ok: false; motivo: string } {
  const rnc = normalizarRnc(valorDe(fila, "rnc"));
  if (rnc.length !== 9 && rnc.length !== 11) {
    return { ok: false, motivo: "RNC/Cédula debe tener 9 u 11 dígitos." };
  }

  const nombre = valorDe(fila, "nombre").trim();
  if (nombre === "") {
    return { ok: false, motivo: "Falta el nombre del tercero." };
  }

  const tipoComprobante = valorDe(fila, "tipoComprobante").trim().toUpperCase();
  if (
    tipoComprobante !== "" &&
    !PATRON_TIPO_COMPROBANTE.test(tipoComprobante)
  ) {
    return {
      ok: false,
      motivo: `Tipo de comprobante inválido: ${tipoComprobante} (use B01–B17 o E31–E47).`,
    };
  }

  const ncf = valorDe(fila, "ncf").trim().toUpperCase();
  if (ncf === "") {
    if (exigirNcf)
      return { ok: false, motivo: "Falta el NCF del comprobante." };
  } else if (!PATRON_NCF.test(ncf)) {
    return { ok: false, motivo: `NCF inválido: ${ncf}.` };
  }

  if (
    ncf !== "" &&
    tipoComprobante !== "" &&
    ncf.slice(0, 3) !== tipoComprobante
  ) {
    return {
      ok: false,
      motivo: `El NCF ${ncf} no corresponde al tipo ${tipoComprobante}.`,
    };
  }

  const fechaEmision = fechaMasiva(valorDe(fila, "fechaEmision"));
  if (fechaEmision === null) {
    return { ok: false, motivo: "Falta la fecha de emisión o no es válida." };
  }

  const brutoVencimiento = valorDe(fila, "fechaVencimiento");
  const fechaVencimiento =
    brutoVencimiento === "" ? null : fechaMasiva(brutoVencimiento);
  if (brutoVencimiento !== "" && fechaVencimiento === null) {
    return { ok: false, motivo: "La fecha de vencimiento no es válida." };
  }
  if (fechaVencimiento !== null && fechaVencimiento < fechaEmision) {
    return {
      ok: false,
      motivo: "El vencimiento no puede ser anterior a la fecha de emisión.",
    };
  }

  const subtotal = aMontoMasivo(valorDe(fila, "subtotal"));
  if (subtotal <= 0) {
    return { ok: false, motivo: "El subtotal debe ser mayor a cero." };
  }

  const itbis = aMontoMasivo(valorDe(fila, "itbis"));
  const retencionIsr = aMontoMasivo(valorDe(fila, "retencionIsr"));
  const retencionItbis = aMontoMasivo(valorDe(fila, "retencionItbis"));

  if (
    [subtotal, itbis, retencionIsr, retencionItbis].some((monto) => monto < 0)
  ) {
    return { ok: false, motivo: "Los montos no pueden ser negativos." };
  }
  if (retencionIsr + retencionItbis > subtotal + itbis) {
    return {
      ok: false,
      motivo: "Las retenciones superan el total de la fila.",
    };
  }

  const concepto = valorDe(fila, "concepto").trim();
  const tipoFinal =
    tipoComprobante === "" && ncf !== "" ? ncf.slice(0, 3) : tipoComprobante;

  return {
    ok: true,
    datos: {
      fila: 0,
      rnc,
      nombre,
      tipoComprobante: tipoFinal,
      ncf,
      fechaEmision,
      fechaVencimiento,
      concepto: concepto === "" ? nombre : concepto,
      subtotal,
      itbis,
      retencionIsr,
      retencionItbis,
    },
  };
}

/** Lee y valida un archivo de compras (606). */
export async function parsearMasivo606(
  contenido: ArrayBuffer,
  nombreArchivo: string,
): Promise<ResultadoParseoMasivo<FilaMasivaCompra>> {
  const crudas = await leerFilas(contenido, nombreArchivo);
  const filas: FilaMasivaCompra[] = [];
  const errores: ErrorFilaMasiva[] = [];

  crudas.forEach((cruda, indice) => {
    const numeroFila = indice + 2;
    const resultado = validarFila(cruda, true);

    if (!resultado.ok) {
      errores.push({ fila: numeroFila, motivo: resultado.motivo });
      return;
    }

    filas.push({ ...resultado.datos, fila: numeroFila });
  });

  return { filas, errores };
}

/** Lee y valida un archivo de ventas (607). El NCF puede quedar vacío. */
export async function parsearMasivo607(
  contenido: ArrayBuffer,
  nombreArchivo: string,
): Promise<ResultadoParseoMasivo<FilaMasivaVenta>> {
  const crudas = await leerFilas(contenido, nombreArchivo);
  const filas: FilaMasivaVenta[] = [];
  const errores: ErrorFilaMasiva[] = [];

  crudas.forEach((cruda, indice) => {
    const numeroFila = indice + 2;
    const resultado = validarFila(cruda, false);

    if (!resultado.ok) {
      errores.push({ fila: numeroFila, motivo: resultado.motivo });
      return;
    }

    const { retencionIsr, retencionItbis, ...comun } = resultado.datos;
    if (retencionIsr > 0 || retencionItbis > 0) {
      // En ventas las retenciones no las aplica la empresa que factura.
      errores.push({
        fila: numeroFila,
        motivo: "En ventas no se registran retenciones retenidas.",
      });
      return;
    }

    filas.push({ ...comun, fila: numeroFila });
  });

  return { filas, errores };
}

/** Plantilla CSV de ejemplo para descargar desde el diálogo de carga masiva. */
export function plantilla606Csv(): string {
  return [
    "RNC,Tercero,Tipo Comprobante,NCF,Fecha,Concepto,Subtotal,ITBIS,Retencion ISR,Retencion ITBIS",
    "101010101,Distribuidora Central SRL,B01,B0100000001,15/01/2026,Compra de mercancía,10000.00,1800.00,0.00,0.00",
  ].join("\r\n");
}

export function plantilla607Csv(): string {
  return [
    "RNC,Tercero,NCF,Fecha,Concepto,Subtotal,ITBIS",
    "101010101,Cliente Ejemplo SRL,B0100000001,15/01/2026,Venta de mercancía,10000.00,1800.00",
  ].join("\r\n");
}
