import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  crearEmpresaReporte,
  describirRangoFechas,
  nombreArchivoConCorte,
  nombreArchivoConPeriodo,
  tablaAgrupadaReporte,
  tablaBalanzaComprobacionReporte,
  tablaCambiosPatrimonioReporte,
  tablaLibroDiarioReporte,
  tablaLibroMayorReporte,
} from "@/lib/reportes/adaptadores";
import { tablaAExcel } from "@/lib/reportes/exportar/excel";
import { tablaAPdf } from "@/lib/reportes/exportar/pdf";
import type { EmpresaReporte } from "@/lib/reportes/exportar/tipos";

const EMPRESA: EmpresaReporte = {
  nombreComercial: "Empresa Sintética",
  razonSocial: "Empresa Sintética SRL",
  rnc: "123456789",
  moneda: "DOP",
};

const GENERADO_EN = new Date("2026-11-24T15:30:00Z");

function tablaEstadoSintetica() {
  return tablaAgrupadaReporte({
    titulo: "Estado de resultados",
    subtitulo: "Del 01/11/2026 al 30/11/2026",
    empresa: EMPRESA,
    filas: [
      { tipo: "grupo", codigo: "", nombre: "INGRESOS", monto: 0 },
      {
        tipo: "detalle",
        codigo: "4-01-001",
        nombre: "Ventas de servicios",
        monto: 1250.75,
      },
      {
        tipo: "subtotal",
        codigo: "",
        nombre: "Subtotal INGRESOS",
        monto: 1250.75,
      },
      { tipo: "total", codigo: "", nombre: "Resultado neto", monto: 1250.75 },
    ],
  });
}

function tablaCambiosPatrimonioSintetica() {
  return tablaCambiosPatrimonioReporte({
    subtitulo: "Del 01/01/2026 al 31/12/2026",
    empresa: EMPRESA,
    filas: [
      {
        tipoFila: "cuenta",
        codigo: "3-01-001",
        nombre: "Capital social",
        saldoInicial: 10000,
        debitos: 3000,
        creditos: 3000,
        movimientoNeto: 0,
        saldoFinal: 10000,
      },
      {
        tipoFila: "resultado",
        codigo: "",
        nombre: "Resultado del período",
        saldoInicial: 0,
        debitos: 2000,
        creditos: 4000,
        movimientoNeto: 2000,
        saldoFinal: 2000,
      },
      {
        tipoFila: "total",
        codigo: "",
        nombre: "Total cambios en el patrimonio",
        saldoInicial: 10000,
        debitos: 5000,
        creditos: 7000,
        movimientoNeto: 2000,
        saldoFinal: 12000,
      },
    ],
  });
}

describe("adaptadores de reportes exportables", () => {
  it("normaliza la empresa, el período visible y los nombres de archivo", () => {
    expect(
      crearEmpresaReporte({
        nombreComercial: "Comercial QA",
        razonSocial: "  ",
        rnc: "",
        moneda: "USD",
      }),
    ).toEqual({
      nombreComercial: "Comercial QA",
      razonSocial: null,
      rnc: null,
      moneda: "USD",
    });

    expect(describirRangoFechas("2026-11-01", "2026-11-30")).toBe(
      "Del 01/11/2026 al 30/11/2026",
    );
    expect(describirRangoFechas("", "")).toBe("Todos los períodos");
    expect(
      nombreArchivoConPeriodo(
        "estado-de-resultados",
        "2026-11-01",
        "2026-11-30",
      ),
    ).toBe("estado-de-resultados-2026-11");
    expect(
      nombreArchivoConPeriodo(
        "estado-de-resultados",
        "2026-01-01",
        "2026-11-24",
      ),
    ).toBe("estado-de-resultados-2026-01-01-al-2026-11-24");
    expect(nombreArchivoConCorte("balance-general", "2026-11-24")).toBe(
      "balance-general-2026-11-24",
    );
  });

  it("convierte la jerarquía contable a estilos y montos numéricos", () => {
    const tabla = tablaEstadoSintetica();

    expect(tabla.empresa).toEqual(EMPRESA);
    expect(tabla.columnas.map((columna) => columna.tipo)).toEqual([
      "texto",
      "texto",
      "dinero",
    ]);
    expect(tabla.filas[0]?.estilo).toBe("grupo");
    expect(tabla.filas[0]?.celdas.monto).toBeNull();
    expect(tabla.filas[1]?.nivel).toBe(1);
    expect(tabla.filas[1]?.celdas.monto).toBe(1250.75);
    expect(tabla.filas[2]?.estilo).toBe("subtotal");
    expect(tabla.filas[3]?.estilo).toBe("total");
  });

  it("agrega totales numéricos al diario y a la balanza", () => {
    const diario = tablaLibroDiarioReporte({
      subtitulo: "Todos los períodos",
      empresa: EMPRESA,
      filas: [
        {
          numero: "AS-0001",
          fecha: "2026-11-05",
          descripcion: "Venta de prueba",
          referencia: "F-1",
          debitos: 100.25,
          creditos: 100.25,
          estado: "contabilizado",
        },
        {
          numero: "AS-0002",
          fecha: "2026-11-06",
          descripcion: "Gasto de prueba",
          referencia: "",
          debitos: 25.5,
          creditos: 25.5,
          estado: "contabilizado",
        },
      ],
    });

    expect(diario.filas.at(-1)?.estilo).toBe("total");
    expect(diario.filas.at(-1)?.celdas.debitos).toBe(125.75);
    expect(diario.filas.at(-1)?.celdas.creditos).toBe(125.75);

    const balanza = tablaBalanzaComprobacionReporte({
      subtitulo: "Del 01/11/2026 al 30/11/2026",
      empresa: EMPRESA,
      filas: [
        {
          codigo: "1-01-001",
          nombre: "Caja",
          saldoAnterior: 10,
          debitos: 100,
          creditos: 20,
          saldoActual: 90,
        },
        {
          codigo: "4-01-001",
          nombre: "Ventas",
          saldoAnterior: 0,
          debitos: 0,
          creditos: 100,
          saldoActual: -100,
        },
      ],
    });

    expect(balanza.filas.at(-1)?.estilo).toBe("total");
    expect(balanza.filas.at(-1)?.celdas.debitos).toBe(100);
    expect(balanza.filas.at(-1)?.celdas.creditos).toBe(120);
    expect(balanza.filas.at(-1)?.celdas.saldoActual).toBe(-10);
  });

  it("convierte mayor y cambios en el patrimonio a tablas exportables", () => {
    const mayor = tablaLibroMayorReporte({
      subtitulo: "Del 01/11/2026 al 30/11/2026 · Cuenta: 1-01-001 · Caja",
      empresa: EMPRESA,
      filas: [
        {
          fecha: "2026-11-05",
          asientoNumero: "JE-2026-00001",
          referencia: "FAC-1",
          descripcion: "Cobro de prueba",
          debito: 100.5,
          credito: 0,
          saldo: 100.5,
        },
      ],
    });

    expect(mayor.titulo).toBe("Libro mayor");
    expect(mayor.columnas.map((columna) => columna.tipo)).toEqual([
      "fecha",
      "texto",
      "texto",
      "dinero",
      "dinero",
      "dinero",
    ]);
    expect(mayor.filas[0]?.celdas.debito).toBe(100.5);
    expect(mayor.filas[0]?.celdas.credito).toBeNull();
    expect(mayor.filas[0]?.celdas.saldo).toBe(100.5);

    const cambios = tablaCambiosPatrimonioSintetica();

    expect(cambios.titulo).toBe("Cambios en el patrimonio");
    expect(cambios.columnas).toHaveLength(7);
    expect(cambios.columnas.slice(2).map((columna) => columna.tipo)).toEqual([
      "dinero",
      "dinero",
      "dinero",
      "dinero",
      "dinero",
    ]);
    expect(cambios.filas[0]?.estilo).toBe("normal");
    expect(cambios.filas[1]?.estilo).toBe("subtotal");
    expect(cambios.filas[2]?.estilo).toBe("total");
    expect(cambios.filas[2]?.celdas.movimientoNeto).toBe(2000);
    expect(cambios.filas[2]?.celdas.saldoFinal).toBe(12000);
  });

  it("genera un Excel real del estado de resultados con datos sintéticos", async () => {
    const buffer = await tablaAExcel(tablaEstadoSintetica(), GENERADO_EN);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(new Uint8Array(buffer).buffer);
    const hoja = libro.getWorksheet("Reporte");

    expect(buffer.byteLength).toBeGreaterThan(0);
    expect(hoja?.getCell("A1").value).toBe("Empresa Sintética");
    expect(hoja?.getCell("A2").value).toBe(
      "Razón social: Empresa Sintética SRL · RNC: 123-45678-9",
    );
    expect(hoja?.getCell("A3").value).toBe("Estado de resultados");
    expect(hoja?.getCell("A4").value).toBe("Del 01/11/2026 al 30/11/2026");
    expect(hoja?.getCell("C9").value).toBe(1250.75);
    expect(hoja?.getCell("C9").numFmt).toBe('"RD$" #,##0.00');
  });

  it("genera un PDF real del mismo reporte sintético", async () => {
    const blob = await tablaAPdf(tablaEstadoSintetica(), GENERADO_EN);
    const contenido = await blob.arrayBuffer();
    const bytes = new Uint8Array(contenido);

    expect(blob.size).toBeGreaterThan(0);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");
  });

  it("genera Excel y PDF reales de cambios en el patrimonio", async () => {
    const tabla = tablaCambiosPatrimonioSintetica();
    const buffer = await tablaAExcel(tabla, GENERADO_EN);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(new Uint8Array(buffer).buffer);
    const hoja = libro.getWorksheet("Reporte");

    expect(buffer.byteLength).toBeGreaterThan(0);
    expect(hoja?.getCell("A1").value).toBe("Empresa Sintética");
    expect(hoja?.getCell("A2").value).toBe(
      "Razón social: Empresa Sintética SRL · RNC: 123-45678-9",
    );
    expect(hoja?.getCell("A3").value).toBe("Cambios en el patrimonio");
    expect(hoja?.getCell("A4").value).toBe("Del 01/01/2026 al 31/12/2026");
    expect(hoja?.getCell("C8").value).toBe(10000);
    expect(hoja?.getCell("D8").value).toBe(3000);
    expect(hoja?.getCell("E8").value).toBe(3000);
    expect(hoja?.getCell("F10").value).toBe(2000);
    expect(hoja?.getCell("G10").value).toBe(12000);
    expect(hoja?.getCell("C8").numFmt).toBe('"RD$" #,##0.00');

    const blob = await tablaAPdf(tabla, GENERADO_EN);
    const contenido = await blob.arrayBuffer();
    const bytes = new Uint8Array(contenido);

    expect(blob.size).toBeGreaterThan(0);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");
  });
});
