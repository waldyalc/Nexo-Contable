/**
 * Parser puro de extractos bancarios en CSV.
 *
 * Formato esperado: `fecha, descripcion, referencia, tipo, monto`.
 * Acepta separador coma o punto y coma, encabezado opcional, fechas
 * `aaaa-mm-dd` o `dd/mm/aaaa` y montos con separadores de miles. Un monto
 * negativo se interpreta como retiro cuando la columna `tipo` está vacía.
 *
 * No toca red ni estado global: es una función pura apta para pruebas.
 */

export type TipoMovimientoExtracto =
  | "deposit"
  | "withdrawal"
  | "transfer"
  | "fee"
  | "interest";

export interface FilaExtractoBancario {
  /** Fecha normalizada `aaaa-mm-dd`. */
  fecha: string;
  descripcion: string;
  referencia: string;
  tipo: TipoMovimientoExtracto;
  /** Siempre positiva: el signo se traduce a `deposit`/`withdrawal`. */
  monto: number;
}

export interface ResultadoParseoExtracto {
  filas: FilaExtractoBancario[];
  errores: string[];
  separador: "," | ";";
}

/** Máximo de filas por importación que acepta el RPC `importar_movimientos_bancarios`. */
export const MAXIMO_FILAS_EXTRACTO = 2000;

const TIPOS_POR_TEXTO: Record<string, TipoMovimientoExtracto> = {
  abono: "deposit",
  credito: "deposit",
  deposito: "deposit",
  deposit: "deposit",
  entrada: "deposit",
  retiro: "withdrawal",
  withdrawal: "withdrawal",
  debito: "withdrawal",
  salida: "withdrawal",
  cargo: "withdrawal",
  pago: "withdrawal",
  transferencia: "transfer",
  transfer: "transfer",
  comision: "fee",
  fee: "fee",
  impuesto: "fee",
  interes: "interest",
  interest: "interest",
};

/** Minúsculas y sin tildes para comparar encabezados y tipos. */
function normalizarTexto(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function detectarSeparador(linea: string): "," | ";" {
  const puntoYComa = (linea.match(/;/g) ?? []).length;
  const comas = (linea.match(/,/g) ?? []).length;
  return puntoYComa > comas ? ";" : ",";
}

/** Divide una línea respetando campos entre comillas dobles. */
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

function construirFecha(
  anioTexto: string | undefined,
  mesTexto: string | undefined,
  diaTexto: string | undefined,
): string | null {
  if (!anioTexto || !mesTexto || !diaTexto) return null;

  const anio = Number(anioTexto);
  const mes = Number(mesTexto);
  const dia = Number(diaTexto);

  if (
    !Number.isInteger(anio) ||
    !Number.isInteger(mes) ||
    !Number.isInteger(dia)
  ) {
    return null;
  }

  if (
    anio < 1900 ||
    anio > 2200 ||
    mes < 1 ||
    mes > 12 ||
    dia < 1 ||
    dia > 31
  ) {
    return null;
  }

  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    return null;
  }

  return `${String(anio).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Normaliza una fecha de extracto a `aaaa-mm-dd`. Devuelve `null` si el texto
 * no es una fecha real.
 */
export function parsearFechaExtracto(valor: string): string | null {
  const texto = valor.trim();

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(texto);
  if (iso) return construirFecha(iso[1], iso[2], iso[3]);

  const diaMesAnio = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(texto);
  if (diaMesAnio) {
    return construirFecha(diaMesAnio[3], diaMesAnio[2], diaMesAnio[1]);
  }

  return null;
}

/**
 * Convierte un monto de extracto en número. Admite `RD$`, `US$`, paréntesis
 * contables `(1,250.00)` y separadores de miles con coma o punto.
 */
export function parsearMontoExtracto(valor: string): number | null {
  let texto = valor
    .trim()
    .replace(/\s/g, "")
    .replace(/(?:RD|US)?\$/g, "");

  if (texto === "") return null;

  let negativo = false;

  if (texto.startsWith("(") && texto.endsWith(")")) {
    negativo = true;
    texto = texto.slice(1, -1);
  }

  if (texto.startsWith("-")) {
    negativo = true;
    texto = texto.slice(1);
  } else if (texto.startsWith("+")) {
    texto = texto.slice(1);
  }

  const tieneComa = texto.includes(",");
  const tienePunto = texto.includes(".");

  if (tieneComa && tienePunto) {
    const ultimaComa = texto.lastIndexOf(",");
    const ultimoPunto = texto.lastIndexOf(".");

    texto =
      ultimaComa > ultimoPunto
        ? texto.replace(/\./g, "").replace(",", ".")
        : texto.replace(/,/g, "");
  } else if (tieneComa) {
    texto = /,\d{1,2}$/.test(texto)
      ? texto.replace(",", ".")
      : texto.replace(/,/g, "");
  }

  const numero = Number(texto);

  if (!Number.isFinite(numero)) return null;

  return negativo ? -numero : numero;
}

function tipoDesdeTexto(valor: string): TipoMovimientoExtracto | null {
  const clave = normalizarTexto(valor);
  if (clave === "") return null;
  return TIPOS_POR_TEXTO[clave] ?? null;
}

interface CeldasFila {
  fecha: string;
  descripcion: string;
  referencia: string;
  tipoTexto: string;
  montoTexto: string;
}

/**
 * Reparte las celdas según el formato documentado. Con cuatro columnas se
 * distingue si la tercera es un tipo de movimiento o una referencia.
 */
function repartirCeldas(celdas: readonly string[]): CeldasFila {
  const fecha = celdas[0] ?? "";
  const descripcion = celdas[1] ?? "";

  if (celdas.length >= 5) {
    return {
      fecha,
      descripcion,
      referencia: celdas[2] ?? "",
      tipoTexto: celdas[3] ?? "",
      montoTexto: celdas[4] ?? "",
    };
  }

  const tercera = celdas[2] ?? "";
  const cuarta = celdas[3] ?? "";

  if (tipoDesdeTexto(tercera) !== null) {
    return {
      fecha,
      descripcion,
      referencia: "",
      tipoTexto: tercera,
      montoTexto: cuarta,
    };
  }

  return {
    fecha,
    descripcion,
    referencia: tercera,
    tipoTexto: "",
    montoTexto: cuarta,
  };
}

/**
 * Parsea el contenido completo de un extracto CSV. Devuelve las filas válidas
 * y la lista de errores por línea para mostrarlos antes de importar.
 */
export function parsearExtractoCsv(texto: string): ResultadoParseoExtracto {
  const lineas = texto
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter((linea) => linea !== "");

  const resultado: ResultadoParseoExtracto = {
    filas: [],
    errores: [],
    separador: ",",
  };

  if (lineas.length === 0) {
    resultado.errores.push("El archivo está vacío.");
    return resultado;
  }

  const separador = detectarSeparador(lineas[0] ?? "");
  resultado.separador = separador;

  const primeraFila = dividirLinea(lineas[0] ?? "", separador);
  const tieneEncabezado = primeraFila.some(
    (celda) => normalizarTexto(celda) === "fecha",
  );
  const inicio = tieneEncabezado ? 1 : 0;

  for (let indice = inicio; indice < lineas.length; indice += 1) {
    const numeroLinea = indice + 1;
    const celdas = dividirLinea(lineas[indice] ?? "", separador);

    if (celdas.length < 4) {
      resultado.errores.push(
        `Línea ${numeroLinea}: se esperan al menos 4 columnas (fecha, descripción, tipo y monto).`,
      );
      continue;
    }

    const fila = repartirCeldas(celdas);
    const fecha = parsearFechaExtracto(fila.fecha);

    if (!fecha) {
      resultado.errores.push(
        `Línea ${numeroLinea}: fecha inválida "${fila.fecha}". Usa aaaa-mm-dd o dd/mm/aaaa.`,
      );
      continue;
    }

    const monto = parsearMontoExtracto(fila.montoTexto);

    if (monto === null) {
      resultado.errores.push(
        `Línea ${numeroLinea}: monto inválido "${fila.montoTexto}".`,
      );
      continue;
    }

    if (monto === 0) {
      resultado.errores.push(
        `Línea ${numeroLinea}: el monto no puede ser cero.`,
      );
      continue;
    }

    const tipoExplicito = tipoDesdeTexto(fila.tipoTexto);

    if (fila.tipoTexto.trim() !== "" && tipoExplicito === null) {
      resultado.errores.push(
        `Línea ${numeroLinea}: tipo de movimiento desconocido "${fila.tipoTexto}".`,
      );
      continue;
    }

    const tipo = tipoExplicito ?? (monto < 0 ? "withdrawal" : "deposit");

    resultado.filas.push({
      fecha,
      descripcion: fila.descripcion.trim(),
      referencia: fila.referencia.trim(),
      tipo,
      monto: Math.round(Math.abs(monto) * 100) / 100,
    });
  }

  if (resultado.filas.length > MAXIMO_FILAS_EXTRACTO) {
    resultado.errores.push(
      `El archivo tiene ${resultado.filas.length} filas; el máximo por importación es ${MAXIMO_FILAS_EXTRACTO}.`,
    );
  }

  if (resultado.filas.length === 0 && resultado.errores.length === 0) {
    resultado.errores.push("No se encontraron movimientos en el archivo.");
  }

  return resultado;
}
