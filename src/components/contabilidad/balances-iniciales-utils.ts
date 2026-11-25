import type { EntradaLineaBalanceInicial } from "@/app/(app)/contabilidad/actions";

export interface ResultadoArchivoBalances {
  filas: EntradaLineaBalanceInicial[];
  errores: string[];
}

function normalizarClave(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function indiceColumna(
  encabezados: readonly string[],
  alias: readonly string[],
): number {
  const normalizados = alias.map(normalizarClave);
  return encabezados.findIndex((encabezado) =>
    normalizados.includes(normalizarClave(encabezado)),
  );
}

function monto(valor: string): number {
  const limpio = valor.replace(/[^\d.,-]/g, "");
  if (limpio.trim() === "") return 0;
  const normalizado =
    limpio.includes(",") && !limpio.includes(".")
      ? limpio.replace(/,/g, ".")
      : limpio.replace(/,/g, "");
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : Number.NaN;
}

/** Convierte la primera hoja/matriz de la plantilla en líneas validadas. */
export function parsearMatrizBalances(
  matriz: readonly (readonly string[])[],
): ResultadoArchivoBalances {
  const encabezados = matriz[0] ?? [];
  const columnaCuenta = indiceColumna(encabezados, [
    "account_code",
    "codigo_cuenta",
    "cuenta",
    "codigo",
  ]);
  const columnaDebito = indiceColumna(encabezados, [
    "debit",
    "debito",
    "cargo",
  ]);
  const columnaCredito = indiceColumna(encabezados, [
    "credit",
    "credito",
    "abono",
  ]);
  const columnaDescripcion = indiceColumna(encabezados, [
    "description",
    "descripcion",
    "detalle",
  ]);

  if (columnaCuenta < 0 || columnaDebito < 0 || columnaCredito < 0) {
    return {
      filas: [],
      errores: [
        "La plantilla debe tener las columnas cuenta, débito y crédito.",
      ],
    };
  }

  const filas: EntradaLineaBalanceInicial[] = [];
  const errores: string[] = [];

  matriz.slice(1).forEach((fila, indice) => {
    const numeroFila = indice + 2;
    const codigo = (fila[columnaCuenta] ?? "").trim();
    const debito = monto(fila[columnaDebito] ?? "");
    const credito = monto(fila[columnaCredito] ?? "");
    const descripcion =
      columnaDescripcion < 0 ? "" : (fila[columnaDescripcion] ?? "").trim();

    if (
      codigo === "" &&
      (fila[columnaDebito] ?? "") === "" &&
      (fila[columnaCredito] ?? "") === ""
    ) {
      return;
    }

    if (codigo === "") {
      errores.push(`Fila ${numeroFila}: falta el código de cuenta.`);
      return;
    }

    if (!Number.isFinite(debito) || !Number.isFinite(credito)) {
      errores.push(`Fila ${numeroFila}: débito o crédito no es numérico.`);
      return;
    }

    if (debito < 0 || credito < 0) {
      errores.push(`Fila ${numeroFila}: no se admiten montos negativos.`);
      return;
    }

    if (debito > 0 === credito > 0) {
      errores.push(
        `Fila ${numeroFila}: registra débito o crédito, nunca ambos ni ninguno.`,
      );
      return;
    }

    filas.push({ codigo, debito, credito, descripcion });
  });

  if (filas.length < 2 && errores.length === 0) {
    errores.push("El balance inicial requiere al menos dos líneas válidas.");
  }

  return { filas, errores };
}

function separarCsv(texto: string): string[][] {
  const lineas = texto
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((linea) => linea.trim() !== "");
  const primera = lineas[0] ?? "";
  const delimitador = [";", ",", "\t"].reduce((mejor, candidato) =>
    primera.split(candidato).length > primera.split(mejor).length
      ? candidato
      : mejor,
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

/** Lee Excel `.xlsx` o CSV con encabezados de cuenta/débito/crédito. */
export async function leerArchivoBalances(
  archivo: File,
): Promise<ResultadoArchivoBalances> {
  if (/\.csv$/i.test(archivo.name)) {
    return parsearMatrizBalances(separarCsv(await archivo.text()));
  }

  const { Workbook } = await import("exceljs");
  const libro = new Workbook();
  await libro.xlsx.load(await archivo.arrayBuffer());
  const hoja = libro.worksheets[0];
  if (!hoja) {
    return { filas: [], errores: ["El libro de Excel no tiene hojas."] };
  }

  const matriz: string[][] = [];
  hoja.eachRow({ includeEmpty: false }, (fila) => {
    const celdas: string[] = [];
    fila.eachCell({ includeEmpty: true }, (celda) => {
      celdas.push(celda.text ?? "");
    });
    matriz.push(celdas);
  });

  return parsearMatrizBalances(matriz);
}
