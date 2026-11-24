import ExcelJS from "exceljs";
import { describe, expect, test } from "vitest";

import {
  type ContextoExportacion,
  type Fila606,
  type Fila607,
  NOMBRE_HOJA_EXCLUIDOS,
  NOMBRE_HOJA_INCLUIDOS_606,
  NOMBRE_HOJA_INCLUIDOS_607,
  fechaDgii,
  generarExcel606,
  generarExcel607,
  generarTxt606,
  generarTxt607,
  montoDgii,
  nombreArchivo606,
  periodoDgii,
} from "../exportar-606-607";

const CONTEXTO: ContextoExportacion = {
  periodo: "2026-01",
  rncEmpresa: "101-01010-1",
  razonSocial: "Nexo Contable Demo SRL",
};

function fila606(parcial: Partial<Fila606>): Fila606 {
  return {
    documento_id: "doc-1",
    tercero_id: "ter-1",
    rnc: "131488791",
    nombre: "SUMINISTROS DEL CIBAO SRL",
    tipo_identificacion: "1",
    tipo_comprobante: "B01",
    ncf: "B0100000001",
    fecha_comprobante: "2026-01-15",
    fecha_pago: "2026-01-20",
    monto_facturado: 1180,
    base_imponible: 1000,
    itbis_facturado: 180,
    retencion_isr: 100,
    retencion_itbis: 0,
    total_retenido: 100,
    incluido: true,
    motivo_exclusion: "",
    ...parcial,
  };
}

function fila607(parcial: Partial<Fila607>): Fila607 {
  return {
    documento_id: "doc-2",
    tercero_id: "ter-2",
    rnc: "101010101",
    nombre: "CLIENTE EJEMPLO SRL",
    tipo_identificacion: "1",
    tipo_comprobante: "B02",
    ncf: "B0200000002",
    fecha_comprobante: "2026-01-16",
    monto_facturado: 1180,
    base_imponible: 1000,
    itbis_facturado: 180,
    itbis_retenido: 0,
    retencion_renta: 0,
    otros_impuestos: 0,
    total: 1180,
    metodo_pago: "EFECTIVO",
    incluido: true,
    motivo_exclusion: "",
    ...parcial,
  };
}

describe("utilidades de formato DGII", () => {
  test("normaliza el periodo a AAAAMM", () => {
    expect(periodoDgii("2026-01")).toBe("202601");
    expect(periodoDgii("202601")).toBe("202601");
  });

  test("convierte la fecha a AAAAMMDD", () => {
    expect(fechaDgii("2026-01-05")).toBe("20260105");
    expect(fechaDgii("2026-01-05T12:00:00")).toBe("20260105");
    expect(fechaDgii("")).toBe("");
  });

  test("formatea los montos con dos decimales y punto decimal", () => {
    expect(montoDgii(1234.5)).toBe("1234.50");
    expect(montoDgii(Number.NaN)).toBe("0.00");
  });

  test("el nombre del archivo lleva el periodo", () => {
    expect(nombreArchivo606("2026-01")).toBe("606_202601.xlsx");
  });
});

describe("Excel 606", () => {
  test("genera dos hojas: incluidos con totales y excluidos con motivo", async () => {
    const buffer = await generarExcel606(
      [
        fila606({}),
        fila606({
          documento_id: "doc-3",
          ncf: "B0100000003",
          nombre: "PROVEEDOR INFORMAL",
          incluido: false,
          motivo_exclusion: "RNC inválido para el formato",
        }),
      ],
      CONTEXTO,
    );

    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(buffer);

    expect(libro.worksheets.map((hoja) => hoja.name)).toEqual([
      NOMBRE_HOJA_INCLUIDOS_606,
      NOMBRE_HOJA_EXCLUIDOS,
    ]);

    const incluidos = libro.getWorksheet(NOMBRE_HOJA_INCLUIDOS_606);
    const excluidos = libro.getWorksheet(NOMBRE_HOJA_EXCLUIDOS);
    expect(incluidos).toBeDefined();
    expect(excluidos).toBeDefined();
    if (!incluidos || !excluidos) return;

    expect(incluidos.getCell("A1").value).toBe("RNC / Cédula");
    expect(incluidos.getCell("A2").value).toBe("131488791");
    expect(incluidos.getCell("G2").value).toBe(1180);
    // Solo el incluido llega a la hoja principal: 1 encabezado + 1 fila + totales.
    expect(incluidos.actualRowCount).toBe(3);
    expect(incluidos.getCell("A3").value).toBe("Total 1 registros");

    expect(excluidos.getCell("A1").value).toBe("Documento");
    expect(excluidos.getCell("B2").value).toBe("PROVEEDOR INFORMAL");
    expect(excluidos.getCell("F2").value).toBe("RNC inválido para el formato");
  });
});

describe("Excel 607", () => {
  test("genera dos hojas con los incluidos y los excluidos", async () => {
    const buffer = await generarExcel607(
      [
        fila607({}),
        fila607({
          documento_id: "doc-4",
          ncf: "",
          nombre: "CONSUMIDOR FINAL",
          incluido: false,
          motivo_exclusion: "Sin NCF válido",
        }),
      ],
      CONTEXTO,
    );

    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(buffer);

    expect(libro.worksheets.map((hoja) => hoja.name)).toEqual([
      NOMBRE_HOJA_INCLUIDOS_607,
      NOMBRE_HOJA_EXCLUIDOS,
    ]);

    const incluidos = libro.getWorksheet(NOMBRE_HOJA_INCLUIDOS_607);
    expect(incluidos).toBeDefined();
    if (!incluidos) return;

    expect(incluidos.getCell("D2").value).toBe("B0200000002");
    expect(incluidos.getCell("L2").value).toBe(1180);
    expect(incluidos.getCell("A3").value).toBe("Total 1 registros");
  });
});

describe("TXT oficial de la DGII", () => {
  test("el 606 abre con la cabecera 606|RNC|AAAAMM|CANTIDAD", () => {
    const texto = generarTxt606([fila606({})], CONTEXTO);
    const lineas = texto.trim().split("\r\n");

    expect(lineas[0]).toBe("606|101010101|202601|1");
    expect(lineas).toHaveLength(2);

    const campos = (lineas[1] ?? "").split("|");
    expect(campos[0]).toBe("1");
    expect(campos[1]).toBe("131488791");
    expect(campos[2]).toBe("B01");
    expect(campos[3]).toBe("B0100000001");
    expect(campos[4]).toBe("20260115");
    expect(campos[5]).toBe("20260120");
    expect(campos[6]).toBe("1180.00");
    expect(campos).toHaveLength(19);
  });

  test("el 607 abre con la cabecera 607|RNC|AAAAMM|CANTIDAD", () => {
    const texto = generarTxt607([fila607({})], CONTEXTO);
    const lineas = texto.trim().split("\r\n");

    expect(lineas[0]).toBe("607|101010101|202601|1");
    expect(lineas).toHaveLength(2);

    const campos = (lineas[1] ?? "").split("|");
    expect(campos[1]).toBe("101010101");
    expect(campos[2]).toBe("B0200000002");
    expect(campos[3]).toBe("20260116");
    expect(campos[12]).toBe("1180.00");
    expect(campos).toHaveLength(13);
  });

  test("los excluidos no entran al TXT ni al conteo de la cabecera", () => {
    const texto = generarTxt606(
      [fila606({}), fila606({ documento_id: "doc-x", incluido: false })],
      CONTEXTO,
    );
    const lineas = texto.trim().split("\r\n");

    expect(lineas[0]).toBe("606|101010101|202601|1");
    expect(lineas).toHaveLength(2);
  });

  test("una cédula de 11 dígitos se reporta como tipo de identificación 2", () => {
    const texto = generarTxt607(
      [fila607({ rnc: "00112345678", tipo_identificacion: "" })],
      CONTEXTO,
    );
    const campos = (texto.trim().split("\r\n")[1] ?? "").split("|");

    expect(campos[0]).toBe("2");
    expect(campos[1]).toBe("00112345678");
  });
});
