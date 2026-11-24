import { type Cell, Workbook } from "exceljs";

import {
  detalleEmpresaReporte,
  formatearFechaHora,
  nombreEmpresaReporte,
  textoCelda,
  valorExcel,
} from "./formato";
import type {
  ColumnaReporte,
  EmpresaReporte,
  FilaReporte,
  TablaReporte,
} from "./tipos";

export const FILA_ENCABEZADOS = 7;
export const PRIMERA_FILA_DATOS = FILA_ENCABEZADOS + 1;

const COLOR_PRIMARIO = "FF176B53";
const COLOR_MENTA = "FFE8F4EE";
const COLOR_TEXTO = "FF172A25";
const COLOR_MUTED = "FF66736D";
const COLOR_BLANCO = "FFFFFFFF";

const FORMATO_DINERO: Record<EmpresaReporte["moneda"], string> = {
  DOP: '"RD$" #,##0.00',
  USD: '"US$" #,##0.00',
};

function esColumnaNumerica(columna: ColumnaReporte): boolean {
  return columna.tipo === "dinero" || columna.tipo === "porcentaje";
}

function anchoColumna(
  columna: ColumnaReporte,
  filas: readonly FilaReporte[],
  moneda: EmpresaReporte["moneda"],
): number {
  const minimo = columna.tipo === "dinero" ? 18 : 12;
  const valores = filas.map(
    (fila) =>
      textoCelda(fila.celdas[columna.clave] ?? null, columna.tipo, moneda)
        .length,
  );
  const maximo = Math.max(minimo, columna.titulo.length + 2, ...valores);
  return Math.min(maximo, 48);
}

function aplicarEstiloFila(
  celda: Cell,
  fila: FilaReporte,
  esPrimeraColumna: boolean,
): void {
  if (fila.estilo === "grupo") {
    celda.font = { bold: true, color: { argb: COLOR_TEXTO } };
    celda.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLOR_MENTA },
    };
  }

  if (fila.estilo === "subtotal" || fila.estilo === "total") {
    celda.font = { bold: true, color: { argb: COLOR_TEXTO } };
  }

  if (fila.estilo === "total") {
    celda.border = {
      ...celda.border,
      top: { style: "thin", color: { argb: COLOR_PRIMARIO } },
    };
  }

  if (esPrimeraColumna && fila.nivel != null && fila.nivel > 0) {
    celda.alignment = { ...celda.alignment, indent: fila.nivel };
  }
}

export async function tablaAExcel(
  tabla: TablaReporte,
  generadoEn: Date = new Date(),
): Promise<ArrayBuffer> {
  const libro = new Workbook();
  const nombreEmpresa = nombreEmpresaReporte(tabla.empresa);
  libro.creator = nombreEmpresa;
  libro.created = generadoEn;
  libro.modified = generadoEn;

  const hoja = libro.addWorksheet("Reporte", {
    views: [{ state: "frozen", ySplit: FILA_ENCABEZADOS }],
  });
  const totalColumnas = Math.max(tabla.columnas.length, 1);

  hoja.columns = tabla.columnas.map((columna) => ({
    width: anchoColumna(columna, tabla.filas, tabla.empresa.moneda),
  }));

  const nombreCelda = hoja.getCell(1, 1);
  nombreCelda.value = nombreEmpresa;
  nombreCelda.font = { bold: true, size: 14, color: { argb: COLOR_PRIMARIO } };

  const detalleCelda = hoja.getCell(2, 1);
  detalleCelda.value = detalleEmpresaReporte(tabla.empresa) || null;
  detalleCelda.font = { size: 10, color: { argb: COLOR_MUTED } };

  const tituloCelda = hoja.getCell(3, 1);
  tituloCelda.value = tabla.titulo;
  tituloCelda.font = { bold: true, size: 12, color: { argb: COLOR_TEXTO } };

  const subtituloCelda = hoja.getCell(4, 1);
  subtituloCelda.value = tabla.subtitulo ?? null;
  subtituloCelda.font = { size: 10, color: { argb: COLOR_MUTED } };

  const generadoCelda = hoja.getCell(5, 1);
  generadoCelda.value = `Generado: ${formatearFechaHora(generadoEn)}`;
  generadoCelda.font = {
    italic: true,
    size: 9,
    color: { argb: COLOR_MUTED },
  };

  if (totalColumnas > 1) {
    for (const numeroFila of [1, 2, 3, 4, 5]) {
      hoja.mergeCells(numeroFila, 1, numeroFila, totalColumnas);
    }
  }

  const filaEncabezados = hoja.getRow(FILA_ENCABEZADOS);
  filaEncabezados.height = 22;
  tabla.columnas.forEach((columna, indice) => {
    const celda = filaEncabezados.getCell(indice + 1);
    celda.value = columna.titulo;
    celda.font = { bold: true, size: 10, color: { argb: COLOR_BLANCO } };
    celda.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLOR_PRIMARIO },
    };
    celda.alignment = {
      vertical: "middle",
      horizontal: esColumnaNumerica(columna) ? "right" : "left",
    };
  });

  tabla.filas.forEach((fila, indiceFila) => {
    const filaHoja = hoja.getRow(PRIMERA_FILA_DATOS + indiceFila);

    tabla.columnas.forEach((columna, indiceColumna) => {
      const celda = filaHoja.getCell(indiceColumna + 1);
      celda.value = valorExcel(
        fila.celdas[columna.clave] ?? null,
        columna.tipo,
      );

      if (columna.tipo === "dinero") {
        celda.numFmt = FORMATO_DINERO[tabla.empresa.moneda];
      }

      if (columna.tipo === "porcentaje") {
        celda.numFmt = '0.00"%"';
      }

      celda.alignment = {
        vertical: "top",
        horizontal: esColumnaNumerica(columna) ? "right" : "left",
      };

      aplicarEstiloFila(celda, fila, indiceColumna === 0);
    });
  });

  return libro.xlsx.writeBuffer();
}
