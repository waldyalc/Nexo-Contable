import ExcelJS from "exceljs";

import { aNumero, formatearFecha } from "@/lib/formato";

/**
 * Exportadores `.xlsx` de los estados contables de Nexo Contable.
 *
 * Cada constructor devuelve un `Buffer` listo para descargar o enviar como
 * base64 desde una Server Action. Los montos se escriben como números con
 * formato `#,##0.00` y las hojas conservan la identidad visual de la firma.
 */

export const COLOR_PRIMARIO = "FF176B53";
export const COLOR_MENTA = "FFE8F4EE";
export const FILA_ENCABEZADO = 5;

export interface FilaBalanzaExcel {
  codigo: string;
  nombre: string;
  saldoAnterior: number | string;
  debitos: number | string;
  creditos: number | string;
  saldoActual: number | string;
}

export interface FilaMayorExcel {
  fecha: string;
  asientoNumero: string;
  referencia: string;
  descripcion: string;
  debito: number | string;
  credito: number | string;
  saldo: number | string;
}

export interface FilaEstadoResultadosExcel {
  clasificacion: string;
  codigo: string;
  nombre: string;
  monto: number | string;
}

export interface FilaBalanceGeneralExcel {
  clasificacion: string;
  codigo: string;
  nombre: string;
  monto: number | string;
}

export interface FilaFlujoEfectivoExcel {
  categoria: string;
  monto: number | string;
}

export interface EncabezadoReporteExcel {
  empresa: string;
  desde?: string;
  hasta?: string;
  fechaCorte?: string;
  cuenta?: string;
}

interface ColumnaExcel {
  encabezado: string;
  ancho: number;
  numerica?: boolean;
}

const ETIQUETA_CLASIFICACION: Record<string, string> = {
  asset: "ACTIVOS",
  liability: "PASIVOS",
  equity: "PATRIMONIO",
  income: "INGRESOS",
  cost: "COSTOS",
  expense: "GASTOS",
};

const ETIQUETA_FLUJO: Record<string, string> = {
  operating: "Actividades de operación",
  investing: "Actividades de inversión",
  financing: "Actividades de financiamiento",
  other: "Otras actividades",
};

const ORDEN_ESTADO_RESULTADOS = ["income", "cost", "expense"] as const;
const ORDEN_BALANCE_GENERAL = ["asset", "liability", "equity"] as const;
const ORDEN_FLUJO = ["operating", "investing", "financing", "other"] as const;

function detallePeriodo(encabezado: EncabezadoReporteExcel): string {
  const partes: string[] = [];

  if (encabezado.desde && encabezado.hasta) {
    partes.push(
      `Del ${formatearFecha(encabezado.desde)} al ${formatearFecha(encabezado.hasta)}`,
    );
  } else if (encabezado.fechaCorte) {
    partes.push(`Al ${formatearFecha(encabezado.fechaCorte)}`);
  }

  if (encabezado.cuenta) {
    partes.push(`Cuenta: ${encabezado.cuenta}`);
  }

  return partes.join(" · ");
}

function crearLibro(
  titulo: string,
  encabezado: EncabezadoReporteExcel,
  nombreHoja: string,
  columnas: readonly ColumnaExcel[],
): { libro: ExcelJS.Workbook; hoja: ExcelJS.Worksheet } {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Nexo Contable";
  libro.created = new Date();
  libro.modified = new Date();

  const hoja = libro.addWorksheet(nombreHoja, {
    views: [{ state: "frozen", ySplit: FILA_ENCABEZADO }],
  });

  for (const [indice, columna] of columnas.entries()) {
    hoja.getColumn(indice + 1).width = columna.ancho;
  }

  const marca = hoja.getCell("A1");
  marca.value = "Nexo Contable";
  marca.font = { bold: true, size: 15, color: { argb: COLOR_PRIMARIO } };

  const tituloCelda = hoja.getCell("A2");
  tituloCelda.value = titulo;
  tituloCelda.font = { bold: true, size: 12, color: { argb: "FF172A25" } };

  const empresaCelda = hoja.getCell("A3");
  empresaCelda.value = `Empresa: ${encabezado.empresa}`;
  empresaCelda.font = { size: 10, color: { argb: "FF66736D" } };

  const periodoCelda = hoja.getCell("A4");
  periodoCelda.value = detallePeriodo(encabezado);
  periodoCelda.font = { size: 10, color: { argb: "FF66736D" } };

  const filaEncabezado = hoja.getRow(FILA_ENCABEZADO);
  for (const [indice, columna] of columnas.entries()) {
    const celda = filaEncabezado.getCell(indice + 1);
    celda.value = columna.encabezado;
    celda.font = {
      bold: true,
      size: 10,
      color: { argb: "FFFFFFFF" },
    };
    celda.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLOR_PRIMARIO },
    };
    celda.alignment = {
      horizontal: columna.numerica ? "right" : "left",
      vertical: "middle",
    };
  }
  filaEncabezado.height = 22;

  return { libro, hoja };
}

function escribirFila(
  hoja: ExcelJS.Worksheet,
  fila: number,
  valores: readonly (string | number | null)[],
  columnas: readonly ColumnaExcel[],
  opciones: { negrita?: boolean; fondo?: string } = {},
) {
  for (const [indice, columna] of columnas.entries()) {
    const celda = hoja.getCell(fila, indice + 1);
    const valor = valores[indice] ?? null;
    celda.value = valor;

    if (columna.numerica && typeof valor === "number") {
      celda.numFmt = "#,##0.00";
      celda.alignment = { horizontal: "right" };
    }

    if (opciones.negrita) {
      celda.font = { bold: true };
    }

    if (opciones.fondo) {
      celda.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: opciones.fondo },
      };
    }
  }
}

async function aBuffer(libro: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from(await libro.xlsx.writeBuffer());
}

/** Balanza de comprobación con totales y verificación de cuadre. */
export async function construirBalanzaComprobacionXlsx(
  encabezado: EncabezadoReporteExcel,
  filas: readonly FilaBalanzaExcel[],
): Promise<Buffer> {
  const columnas: readonly ColumnaExcel[] = [
    { encabezado: "Código", ancho: 14 },
    { encabezado: "Cuenta", ancho: 46 },
    { encabezado: "Saldo anterior", ancho: 17, numerica: true },
    { encabezado: "Débitos", ancho: 16, numerica: true },
    { encabezado: "Créditos", ancho: 16, numerica: true },
    { encabezado: "Saldo actual", ancho: 17, numerica: true },
  ];

  const { libro, hoja } = crearLibro(
    "Balanza de comprobación",
    encabezado,
    "Balanza",
    columnas,
  );

  let saldoAnterior = 0;
  let debitos = 0;
  let creditos = 0;
  let saldoActual = 0;

  filas.forEach((fila, indice) => {
    saldoAnterior += aNumero(fila.saldoAnterior);
    debitos += aNumero(fila.debitos);
    creditos += aNumero(fila.creditos);
    saldoActual += aNumero(fila.saldoActual);

    escribirFila(
      hoja,
      FILA_ENCABEZADO + 1 + indice,
      [
        fila.codigo,
        fila.nombre,
        aNumero(fila.saldoAnterior),
        aNumero(fila.debitos),
        aNumero(fila.creditos),
        aNumero(fila.saldoActual),
      ],
      columnas,
    );
  });

  const filaTotales = FILA_ENCABEZADO + 1 + filas.length;
  escribirFila(
    hoja,
    filaTotales,
    ["", "Totales", saldoAnterior, debitos, creditos, saldoActual],
    columnas,
    { negrita: true, fondo: COLOR_MENTA },
  );
  escribirFila(
    hoja,
    filaTotales + 1,
    ["", "Diferencia (débitos − créditos)", "", "", "", debitos - creditos],
    columnas,
    { negrita: true },
  );

  return aBuffer(libro);
}

/** Libro mayor de una cuenta con saldo acumulado por movimiento. */
export async function construirLibroMayorXlsx(
  encabezado: EncabezadoReporteExcel,
  filas: readonly FilaMayorExcel[],
): Promise<Buffer> {
  const columnas: readonly ColumnaExcel[] = [
    { encabezado: "Fecha", ancho: 13 },
    { encabezado: "Asiento", ancho: 17 },
    { encabezado: "Referencia", ancho: 20 },
    { encabezado: "Descripción", ancho: 46 },
    { encabezado: "Débito", ancho: 16, numerica: true },
    { encabezado: "Crédito", ancho: 16, numerica: true },
    { encabezado: "Saldo", ancho: 17, numerica: true },
  ];

  const { libro, hoja } = crearLibro(
    "Libro mayor",
    encabezado,
    "Libro Mayor",
    columnas,
  );

  let debitos = 0;
  let creditos = 0;
  let ultimoSaldo = 0;

  filas.forEach((fila, indice) => {
    const debito = aNumero(fila.debito);
    const credito = aNumero(fila.credito);
    debitos += debito;
    creditos += credito;
    ultimoSaldo = aNumero(fila.saldo);

    escribirFila(
      hoja,
      FILA_ENCABEZADO + 1 + indice,
      [
        formatearFecha(fila.fecha),
        fila.asientoNumero,
        fila.referencia,
        fila.descripcion,
        debito,
        credito,
        ultimoSaldo,
      ],
      columnas,
    );
  });

  const filaTotales = FILA_ENCABEZADO + 1 + filas.length;
  escribirFila(
    hoja,
    filaTotales,
    ["", "Totales", "", "", debitos, creditos, ultimoSaldo],
    columnas,
    { negrita: true, fondo: COLOR_MENTA },
  );

  return aBuffer(libro);
}

/** Estado de resultados agrupado por ingresos, costos y gastos. */
export async function construirEstadoResultadosXlsx(
  encabezado: EncabezadoReporteExcel,
  filas: readonly FilaEstadoResultadosExcel[],
): Promise<Buffer> {
  const columnas: readonly ColumnaExcel[] = [
    { encabezado: "Código", ancho: 14 },
    { encabezado: "Cuenta", ancho: 48 },
    { encabezado: "Monto", ancho: 18, numerica: true },
  ];

  const { libro, hoja } = crearLibro(
    "Estado de resultados",
    encabezado,
    "Estado de Resultados",
    columnas,
  );

  let fila = FILA_ENCABEZADO + 1;
  let ingresos = 0;
  let costos = 0;
  let gastos = 0;

  for (const clasificacion of ORDEN_ESTADO_RESULTADOS) {
    const grupo = filas.filter((f) => f.clasificacion === clasificacion);

    escribirFila(
      hoja,
      fila,
      [ETIQUETA_CLASIFICACION[clasificacion] ?? clasificacion, "", ""],
      columnas,
      { negrita: true, fondo: COLOR_MENTA },
    );
    fila += 1;

    let subtotal = 0;
    for (const cuenta of grupo) {
      const monto = aNumero(cuenta.monto);
      subtotal += monto;
      escribirFila(hoja, fila, [cuenta.codigo, cuenta.nombre, monto], columnas);
      fila += 1;
    }

    if (clasificacion === "income") ingresos = subtotal;
    if (clasificacion === "cost") costos = subtotal;
    if (clasificacion === "expense") gastos = subtotal;

    escribirFila(
      hoja,
      fila,
      [
        "",
        `Subtotal ${ETIQUETA_CLASIFICACION[clasificacion] ?? clasificacion}`,
        subtotal,
      ],
      columnas,
      { negrita: true },
    );
    fila += 1;
  }

  escribirFila(
    hoja,
    fila,
    ["", "Resultado neto", ingresos - costos - gastos],
    columnas,
    { negrita: true, fondo: COLOR_MENTA },
  );

  return aBuffer(libro);
}

/** Balance general con verificación de la ecuación contable. */
export async function construirBalanceGeneralXlsx(
  encabezado: EncabezadoReporteExcel,
  filas: readonly FilaBalanceGeneralExcel[],
  resultado: number | string,
): Promise<Buffer> {
  const columnas: readonly ColumnaExcel[] = [
    { encabezado: "Código", ancho: 14 },
    { encabezado: "Cuenta", ancho: 48 },
    { encabezado: "Monto", ancho: 18, numerica: true },
  ];

  const { libro, hoja } = crearLibro(
    "Balance general",
    encabezado,
    "Balance General",
    columnas,
  );

  let fila = FILA_ENCABEZADO + 1;
  let activos = 0;
  let pasivos = 0;
  let patrimonio = 0;

  for (const clasificacion of ORDEN_BALANCE_GENERAL) {
    const grupo = filas.filter((f) => f.clasificacion === clasificacion);

    escribirFila(
      hoja,
      fila,
      [ETIQUETA_CLASIFICACION[clasificacion] ?? clasificacion, "", ""],
      columnas,
      { negrita: true, fondo: COLOR_MENTA },
    );
    fila += 1;

    let subtotal = 0;
    for (const cuenta of grupo) {
      const monto = aNumero(cuenta.monto);
      subtotal += monto;
      escribirFila(hoja, fila, [cuenta.codigo, cuenta.nombre, monto], columnas);
      fila += 1;
    }

    if (clasificacion === "asset") activos = subtotal;
    if (clasificacion === "liability") pasivos = subtotal;
    if (clasificacion === "equity") patrimonio = subtotal;

    escribirFila(
      hoja,
      fila,
      [
        "",
        `Total ${ETIQUETA_CLASIFICACION[clasificacion] ?? clasificacion}`,
        subtotal,
      ],
      columnas,
      { negrita: true },
    );
    fila += 1;
  }

  const resultadoNumero = aNumero(resultado);
  const pasivoPatrimonioResultado = pasivos + patrimonio + resultadoNumero;

  escribirFila(
    hoja,
    fila,
    ["", "Resultado del período", resultadoNumero],
    columnas,
    { negrita: true },
  );
  fila += 1;
  escribirFila(
    hoja,
    fila,
    ["", "Pasivo + Patrimonio + Resultado", pasivoPatrimonioResultado],
    columnas,
    { negrita: true, fondo: COLOR_MENTA },
  );
  fila += 1;
  escribirFila(
    hoja,
    fila,
    [
      "",
      "Diferencia (activos − pasivo − patrimonio − resultado)",
      activos - pasivoPatrimonioResultado,
    ],
    columnas,
    { negrita: true },
  );

  return aBuffer(libro);
}

/** Flujo de efectivo agrupado por operación, inversión y financiamiento. */
export async function construirFlujoEfectivoXlsx(
  encabezado: EncabezadoReporteExcel,
  filas: readonly FilaFlujoEfectivoExcel[],
): Promise<Buffer> {
  const columnas: readonly ColumnaExcel[] = [
    { encabezado: "Categoría", ancho: 42 },
    { encabezado: "Monto", ancho: 18, numerica: true },
  ];

  const { libro, hoja } = crearLibro(
    "Flujo de efectivo",
    encabezado,
    "Flujo de Efectivo",
    columnas,
  );

  let fila = FILA_ENCABEZADO + 1;
  let total = 0;

  for (const categoria of ORDEN_FLUJO) {
    const monto = filas
      .filter((f) => f.categoria === categoria)
      .reduce((acumulado, f) => acumulado + aNumero(f.monto), 0);

    if (monto === 0) continue;

    total += monto;
    escribirFila(
      hoja,
      fila,
      [ETIQUETA_FLUJO[categoria] ?? categoria, monto],
      columnas,
    );
    fila += 1;
  }

  escribirFila(hoja, fila, ["Flujo neto del período", total], columnas, {
    negrita: true,
    fondo: COLOR_MENTA,
  });

  return aBuffer(libro);
}
