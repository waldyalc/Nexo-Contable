import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  FILA_ENCABEZADO,
  construirBalanceGeneralXlsx,
  construirBalanzaComprobacionXlsx,
  construirEstadoResultadosXlsx,
  construirFlujoEfectivoXlsx,
  construirLibroMayorXlsx,
} from "@/lib/contabilidad/exportar-excel";

const ENCABEZADO = {
  empresa: "Empresa de Prueba SRL",
  desde: "2026-01-01",
  hasta: "2026-12-31",
};

async function abrir(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(new Uint8Array(buffer).buffer);
  return libro;
}

function valorNumerico(
  hoja: ExcelJS.Worksheet,
  fila: number,
  columna: number,
): number {
  const valor = hoja.getCell(fila, columna).value;
  return typeof valor === "number" ? valor : 0;
}

describe("exportar-excel: balanza de comprobación", () => {
  it("genera la hoja con encabezados, montos y totales cuadrados", async () => {
    const buffer = await construirBalanzaComprobacionXlsx(ENCABEZADO, [
      {
        codigo: "1101",
        nombre: "Caja",
        saldoAnterior: 100,
        debitos: 250.5,
        creditos: 50.5,
        saldoActual: 300,
      },
      {
        codigo: "4101",
        nombre: "Ingresos por servicios",
        saldoAnterior: 0,
        debitos: 0,
        creditos: 200,
        saldoActual: -200,
      },
    ]);

    const libro = await abrir(buffer);
    expect(libro.creator).toBe("Nexo Contable");

    const hoja = libro.getWorksheet("Balanza");
    expect(hoja).toBeDefined();
    if (!hoja) return;

    expect(hoja.getCell(FILA_ENCABEZADO, 1).value).toBe("Código");
    expect(hoja.getCell(FILA_ENCABEZADO, 6).value).toBe("Saldo actual");
    expect(hoja.getCell(FILA_ENCABEZADO + 1, 1).value).toBe("1101");

    const filaTotales = FILA_ENCABEZADO + 1 + 2;
    expect(hoja.getCell(filaTotales, 2).value).toBe("Totales");
    expect(valorNumerico(hoja, filaTotales, 4)).toBeCloseTo(250.5, 2);
    expect(valorNumerico(hoja, filaTotales, 5)).toBeCloseTo(250.5, 2);
    expect(valorNumerico(hoja, filaTotales + 1, 6)).toBeCloseTo(0, 2);
  });
});

describe("exportar-excel: libro mayor", () => {
  it("exporta los movimientos y el saldo final de la cuenta", async () => {
    const buffer = await construirLibroMayorXlsx(ENCABEZADO, [
      {
        fecha: "2026-01-15",
        asientoNumero: "JE-2026-00001",
        referencia: "FAC-001",
        descripcion: "Venta de servicios",
        debito: 1000,
        credito: 0,
        saldo: 1000,
      },
      {
        fecha: "2026-01-20",
        asientoNumero: "JE-2026-00002",
        referencia: "PAG-001",
        descripcion: "Cobro parcial",
        debito: 0,
        credito: 400,
        saldo: 600,
      },
    ]);

    const libro = await abrir(buffer);
    const hoja = libro.getWorksheet("Libro Mayor");
    expect(hoja).toBeDefined();
    if (!hoja) return;

    expect(hoja.getCell(FILA_ENCABEZADO + 1, 1).value).toBe("15/01/2026");
    expect(hoja.getCell(FILA_ENCABEZADO + 2, 4).value).toBe("Cobro parcial");

    const filaTotales = FILA_ENCABEZADO + 1 + 2;
    expect(valorNumerico(hoja, filaTotales, 5)).toBeCloseTo(1000, 2);
    expect(valorNumerico(hoja, filaTotales, 6)).toBeCloseTo(400, 2);
    expect(valorNumerico(hoja, filaTotales, 7)).toBeCloseTo(600, 2);
  });
});

describe("exportar-excel: estado de resultados", () => {
  it("agrupa ingresos, costos y gastos y calcula el resultado neto", async () => {
    const buffer = await construirEstadoResultadosXlsx(ENCABEZADO, [
      {
        clasificacion: "income",
        codigo: "4101",
        nombre: "Ingresos por servicios",
        monto: 5000,
      },
      {
        clasificacion: "cost",
        codigo: "5101",
        nombre: "Costo de ventas",
        monto: 2000,
      },
      {
        clasificacion: "expense",
        codigo: "6101",
        nombre: "Gastos operativos",
        monto: 1500,
      },
    ]);

    const libro = await abrir(buffer);
    const hoja = libro.getWorksheet("Estado de Resultados");
    expect(hoja).toBeDefined();
    if (!hoja) return;

    const ultimaFila = hoja.rowCount;
    expect(hoja.getCell(ultimaFila, 2).value).toBe("Resultado neto");
    expect(valorNumerico(hoja, ultimaFila, 3)).toBeCloseTo(1500, 2);
  });
});

describe("exportar-excel: balance general", () => {
  it("verifica que activos = pasivo + patrimonio + resultado", async () => {
    const buffer = await construirBalanceGeneralXlsx(
      { ...ENCABEZADO, fechaCorte: "2026-12-31" },
      [
        {
          clasificacion: "asset",
          codigo: "1101",
          nombre: "Caja",
          monto: 8000,
        },
        {
          clasificacion: "liability",
          codigo: "2101",
          nombre: "Cuentas por pagar",
          monto: 3000,
        },
        {
          clasificacion: "equity",
          codigo: "3101",
          nombre: "Capital",
          monto: 3500,
        },
      ],
      1500,
    );

    const libro = await abrir(buffer);
    const hoja = libro.getWorksheet("Balance General");
    expect(hoja).toBeDefined();
    if (!hoja) return;

    const ultimaFila = hoja.rowCount;
    expect(hoja.getCell(ultimaFila, 2).value).toContain("Diferencia");
    expect(valorNumerico(hoja, ultimaFila, 3)).toBeCloseTo(0, 2);
  });
});

describe("exportar-excel: flujo de efectivo", () => {
  it("agrupa las categorías y calcula el flujo neto", async () => {
    const buffer = await construirFlujoEfectivoXlsx(ENCABEZADO, [
      { categoria: "operating", monto: 1200 },
      { categoria: "investing", monto: -500 },
      { categoria: "financing", monto: 300 },
    ]);

    const libro = await abrir(buffer);
    const hoja = libro.getWorksheet("Flujo de Efectivo");
    expect(hoja).toBeDefined();
    if (!hoja) return;

    expect(hoja.getCell(FILA_ENCABEZADO + 1, 1).value).toBe(
      "Actividades de operación",
    );

    const ultimaFila = hoja.rowCount;
    expect(hoja.getCell(ultimaFila, 1).value).toBe("Flujo neto del período");
    expect(valorNumerico(hoja, ultimaFila, 2)).toBeCloseTo(1000, 2);
  });
});
