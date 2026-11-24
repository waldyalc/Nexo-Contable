import { parsearMontoExtracto } from "@/lib/bancos/csv-extracto";

/**
 * Lectura de la carga masiva de artículos desde CSV o desde una hoja de
 * Excel ya convertida en matriz de texto. Columnas esperadas:
 * `sku, nombre, unidad, descripcion, precio_venta`.
 */

export interface FilaArticuloCarga {
  sku: string;
  nombre: string;
  unidad: string;
  descripcion: string;
  precioVenta: number;
}

export interface ResultadoFilasArticulos {
  filas: FilaArticuloCarga[];
  errores: string[];
}

export const MAXIMO_FILAS_ARTICULOS = 500;

function normalizarTexto(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function dividirLinea(linea: string, separador: string): string[] {
  const celdas: string[] = [];
  let actual = "";
  let entreComillas = false;

  for (let indice = 0; indice < linea.length; indice += 1) {
    const caracter = linea.charAt(indice);

    if (caracter === '"') {
      if (entreComillas && linea.charAt(indice + 1) === '"') {
        actual += '"';
        indice += 1;
        continue;
      }
      entreComillas = !entreComillas;
      continue;
    }

    if (caracter === separador && !entreComillas) {
      celdas.push(actual.trim());
      actual = "";
      continue;
    }

    actual += caracter;
  }

  celdas.push(actual.trim());
  return celdas;
}

function detectarSeparador(linea: string): "," | ";" {
  const puntoYComa = (linea.match(/;/g) ?? []).length;
  const comas = (linea.match(/,/g) ?? []).length;
  return puntoYComa > comas ? ";" : ",";
}

/** Convierte una matriz de celdas (CSV o Excel) en filas de artículos. */
export function filasDesdeMatriz(
  matriz: readonly (readonly string[])[],
): ResultadoFilasArticulos {
  const resultado: ResultadoFilasArticulos = { filas: [], errores: [] };
  const filas = matriz.filter((fila) =>
    fila.some((celda) => celda.trim() !== ""),
  );

  if (filas.length === 0) {
    resultado.errores.push("El archivo está vacío.");
    return resultado;
  }

  const primera = filas[0] ?? [];
  const inicio = primera.some((celda) => normalizarTexto(celda) === "sku")
    ? 1
    : 0;

  for (let indice = inicio; indice < filas.length; indice += 1) {
    const numero = indice + 1;
    const fila = filas[indice] ?? [];
    const sku = (fila[0] ?? "").trim();
    const nombre = (fila[1] ?? "").trim();
    const unidad = (fila[2] ?? "").trim();
    const descripcion = (fila[3] ?? "").trim();
    const precioTexto = (fila[4] ?? "0").trim();

    if (sku === "" || nombre === "") {
      resultado.errores.push(
        `Fila ${numero}: el SKU y el nombre son obligatorios.`,
      );
      continue;
    }

    const precio = parsearMontoExtracto(precioTexto);

    if (precio === null || precio < 0) {
      resultado.errores.push(
        `Fila ${numero}: precio de venta inválido "${precioTexto}".`,
      );
      continue;
    }

    resultado.filas.push({
      sku,
      nombre,
      unidad: unidad === "" ? "UNIDAD" : unidad,
      descripcion,
      precioVenta: Math.round(precio * 100) / 100,
    });
  }

  if (resultado.filas.length > MAXIMO_FILAS_ARTICULOS) {
    resultado.errores.push(
      `El archivo tiene ${resultado.filas.length} filas; el máximo es ${MAXIMO_FILAS_ARTICULOS}.`,
    );
  }

  if (resultado.filas.length === 0 && resultado.errores.length === 0) {
    resultado.errores.push("No se encontraron artículos en el archivo.");
  }

  return resultado;
}

/** Parsea un CSV de artículos con separador coma o punto y coma. */
export function parsearArticulosCsv(texto: string): ResultadoFilasArticulos {
  const lineas = texto
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter((linea) => linea !== "");

  if (lineas.length === 0) {
    return { filas: [], errores: ["El archivo está vacío."] };
  }

  const separador = detectarSeparador(lineas[0] ?? "");
  const matriz = lineas.map((linea) => dividirLinea(linea, separador));

  return filasDesdeMatriz(matriz);
}
