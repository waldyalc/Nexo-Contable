import { inflateSync } from "node:zlib";

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { tablaAExcel } from "./excel";
import {
  formatearFecha,
  formatearFechaHora,
  formatearPorcentaje,
  textoCelda,
  valorExcel,
} from "./formato";
import { tablaAPdf } from "./pdf";
import type { EmpresaReporte, TablaReporte } from "./tipos";

const GENERADO_EN = new Date("2026-03-10T15:30:00Z");

const EMPRESA: EmpresaReporte = {
  nombreComercial: "Empresa de Prueba",
  razonSocial: "Empresa de Prueba SRL",
  rnc: "000000000",
  moneda: "DOP",
};

const TABLA: TablaReporte = {
  titulo: "Cuentas por cobrar",
  subtitulo: "Fecha de corte: 31/01/2026",
  empresa: EMPRESA,
  columnas: [
    { clave: "cliente", titulo: "Cliente", tipo: "texto" },
    { clave: "facturas", titulo: "Facturas", tipo: "texto" },
    { clave: "total", titulo: "Total", tipo: "dinero" },
    { clave: "vencido", titulo: "Vencido", tipo: "porcentaje" },
    { clave: "vence", titulo: "Vence", tipo: "fecha" },
  ],
  filas: [
    {
      celdas: {
        cliente: "Cliente Uno",
        facturas: 2,
        total: 1234.56,
        vencido: 12.5,
        vence: "2026-01-15",
      },
    },
    {
      celdas: {
        cliente: "Cliente Dos",
        facturas: 1,
        total: 200,
        vencido: 0,
        vence: null,
      },
      nivel: 1,
    },
    {
      celdas: {
        cliente: "Subtotal",
        facturas: 3,
        total: 1434.56,
        vencido: 12.5,
        vence: null,
      },
      estilo: "subtotal",
    },
    {
      celdas: {
        cliente: "Total por cobrar",
        facturas: 3,
        total: 1434.56,
        vencido: 12.5,
        vence: null,
      },
      estilo: "total",
    },
  ],
};

async function abrirExcel(buffer: ArrayBuffer): Promise<ExcelJS.Workbook> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(new Uint8Array(buffer).buffer);
  return libro;
}

function obtenerHoja(libro: ExcelJS.Workbook): ExcelJS.Worksheet {
  const hoja = libro.getWorksheet("Reporte");
  if (!hoja) throw new Error("El libro no contiene la hoja Reporte");
  return hoja;
}

function extraerTextoPdf(contenido: ArrayBuffer): string {
  const buffer = Buffer.from(contenido);
  let posicion = 0;
  let texto = "";

  while (posicion < buffer.length) {
    const inicioStream = buffer.indexOf("stream\n", posicion);
    if (inicioStream === -1) break;

    const finStream = buffer.indexOf("endstream", inicioStream);
    if (finStream === -1) break;

    let finDatos = finStream;
    while (
      finDatos > inicioStream &&
      [10, 13].includes(buffer[finDatos - 1] ?? 0)
    ) {
      finDatos -= 1;
    }

    try {
      const inflado = inflateSync(
        buffer.subarray(inicioStream + "stream\n".length, finDatos),
      ).toString("latin1");

      for (const coincidencia of inflado.matchAll(/<([0-9a-fA-F]+)>/g)) {
        const hexadecimal = coincidencia[1];
        if (!hexadecimal) continue;
        texto += Buffer.from(hexadecimal, "hex").toString("latin1");
      }
    } catch {
      posicion = finStream + "endstream".length;
      continue;
    }

    posicion = finStream + "endstream".length;
  }

  return texto;
}

describe("tablaAExcel", () => {
  it("produce un ArrayBuffer XLSX no vacío con firma ZIP", async () => {
    const buffer = await tablaAExcel(TABLA, GENERADO_EN);
    const bytes = new Uint8Array(buffer);

    expect(buffer.byteLength).toBeGreaterThan(0);
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("escribe el encabezado desde la empresa activa y las columnas", async () => {
    const libro = await abrirExcel(await tablaAExcel(TABLA, GENERADO_EN));
    const hoja = obtenerHoja(libro);

    expect(libro.creator).toBe("Empresa de Prueba");
    expect(hoja.getCell("A1").value).toBe("Empresa de Prueba");
    expect(hoja.getCell("A2").value).toBe(
      "Razón social: Empresa de Prueba SRL · RNC: 000-00000-0",
    );
    expect(hoja.getCell("A3").value).toBe("Cuentas por cobrar");
    expect(hoja.getCell("A4").value).toBe("Fecha de corte: 31/01/2026");
    expect(hoja.getCell("A5").value).toBe(
      `Generado: ${formatearFechaHora(GENERADO_EN)}`,
    );

    expect(hoja.getCell("A7").value).toBe("Cliente");
    expect(hoja.getCell("B7").value).toBe("Facturas");
    expect(hoja.getCell("C7").value).toBe("Total");
    expect(hoja.getCell("D7").value).toBe("Vencido");
    expect(hoja.getCell("E7").value).toBe("Vence");
  });

  it("mantiene dinero como número real y aplica formatos y estilos", async () => {
    const libro = await abrirExcel(await tablaAExcel(TABLA, GENERADO_EN));
    const hoja = obtenerHoja(libro);

    expect(hoja.getCell("C8").value).toBe(1234.56);
    expect(hoja.getCell("C8").numFmt).toBe('"RD$" #,##0.00');
    expect(hoja.getCell("D8").value).toBe(12.5);
    expect(hoja.getCell("D8").numFmt).toBe('0.00"%"');
    expect(hoja.getCell("E8").value).toBe("15/01/2026");
    expect(hoja.getCell("E9").value).toBeNull();

    expect(hoja.getCell("A9").alignment.indent).toBe(1);
    expect(hoja.getCell("A10").font.bold).toBe(true);
    expect(hoja.getCell("A11").font.bold).toBe(true);
    expect(hoja.getCell("A11").border.top?.style).toBe("thin");
  });

  it("genera un libro válido cuando la empresa no tiene RNC ni razón social", async () => {
    const tablaMinima: TablaReporte = {
      ...TABLA,
      empresa: { ...EMPRESA, razonSocial: null, rnc: null, moneda: "USD" },
    };

    const buffer = await tablaAExcel(tablaMinima, GENERADO_EN);
    const libro = await abrirExcel(buffer);
    const hoja = obtenerHoja(libro);

    expect(buffer.byteLength).toBeGreaterThan(0);
    expect(hoja.getCell("A1").value).toBe("Empresa de Prueba");
    expect(hoja.getCell("A2").value).toBeNull();
    expect(hoja.getCell("C8").numFmt).toBe('"US$" #,##0.00');
  });
});

describe("tablaAPdf", () => {
  it("produce un PDF válido con encabezado de la empresa activa", async () => {
    const blob = await tablaAPdf(TABLA, GENERADO_EN);
    const contenido = await blob.arrayBuffer();
    const bytes = new Uint8Array(contenido);
    const texto = `${Buffer.from(contenido).toString("latin1")}\n${extraerTextoPdf(contenido)}`;

    expect(blob.size).toBeGreaterThan(0);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");
    expect(texto).toContain("Empresa de Prueba");
    expect(texto).toContain("Empresa de Prueba SRL");
    expect(texto).toContain("000-00000-0");
    expect(texto).toContain("Cuentas por cobrar");
    expect(texto).toContain("Fecha de corte: 31/01/2026");
    expect(texto).toContain("Generado por Nexo Contable");
    expect(texto).toContain("1 de 1");
  });

  it("no falla cuando la empresa no tiene RNC ni razón social", async () => {
    const tablaMinima: TablaReporte = {
      ...TABLA,
      empresa: { ...EMPRESA, razonSocial: null, rnc: null },
    };

    const blob = await tablaAPdf(tablaMinima, GENERADO_EN);

    expect(blob.size).toBeGreaterThan(0);
  });
});

describe("formato del motor de exportación", () => {
  it("formatea dinero decimal según la moneda de la empresa", () => {
    expect(textoCelda(1234.56, "dinero", "DOP")).toBe("RD$ 1,234.56");
    expect(textoCelda(100, "dinero", "USD")).toBe("US$ 100.00");
    expect(valorExcel(1234.56, "dinero")).toBe(1234.56);
    expect(valorExcel("1,234.56", "dinero")).toBe(1234.56);
  });

  it("formatea porcentajes con sufijo", () => {
    expect(formatearPorcentaje(12.5)).toMatch(/^12[.,]50 %$/);
    expect(textoCelda(12.5, "porcentaje")).toMatch(/^12[.,]50 %$/);
    expect(valorExcel(12.5, "porcentaje")).toBe(12.5);
  });

  it("formatea fechas ISO sin depender de la zona horaria", () => {
    expect(formatearFecha("2026-01-15")).toBe("15/01/2026");
    expect(formatearFecha("2026-01-15T23:30:00-04:00")).toBe("15/01/2026");
    expect(formatearFecha(null)).toBe("");
    expect(textoCelda("2026-01-15", "fecha")).toBe("15/01/2026");
    expect(valorExcel("2026-01-15", "fecha")).toBe("15/01/2026");
  });

  it("formatea el timestamp de generación en America/Santo_Domingo", () => {
    expect(formatearFechaHora(new Date("2026-11-25T03:00:00Z"))).toContain(
      "24 nov 2026",
    );
  });

  it("deja vacías las celdas nulas y respeta el texto", () => {
    expect(textoCelda(null, "texto")).toBe("");
    expect(textoCelda(3, "texto")).toBe("3");
    expect(valorExcel(null, "dinero")).toBeNull();
    expect(valorExcel("", "texto")).toBeNull();
    expect(valorExcel(3, "texto")).toBe(3);
  });
});
