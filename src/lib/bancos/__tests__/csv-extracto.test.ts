import { describe, expect, it } from "vitest";

import {
  parsearExtractoCsv,
  parsearFechaExtracto,
  parsearMontoExtracto,
} from "@/lib/bancos/csv-extracto";

describe("bancos: parser de extractos CSV", () => {
  it("parsea un CSV separado por comas con encabezado", () => {
    const csv = [
      "fecha,descripcion,referencia,tipo,monto",
      "2026-11-02,Depósito de cliente,DEP-001,deposito,1500.00",
      "03/11/2026,Retiro cajero,ATM-01,retiro,200.50",
    ].join("\n");

    const resultado = parsearExtractoCsv(csv);

    expect(resultado.errores).toEqual([]);
    expect(resultado.separador).toBe(",");
    expect(resultado.filas).toEqual([
      {
        fecha: "2026-11-02",
        descripcion: "Depósito de cliente",
        referencia: "DEP-001",
        tipo: "deposit",
        monto: 1500,
      },
      {
        fecha: "2026-11-03",
        descripcion: "Retiro cajero",
        referencia: "ATM-01",
        tipo: "withdrawal",
        monto: 200.5,
      },
    ]);
  });

  it("parsea un CSV separado por punto y coma sin encabezado", () => {
    const csv = [
      "2026-01-15;Pago proveedor;CHQ-90;withdrawal;850,25",
      "16/01/2026;Interés ganado;;interés;12.10",
    ].join("\n");

    const resultado = parsearExtractoCsv(csv);

    expect(resultado.errores).toEqual([]);
    expect(resultado.separador).toBe(";");
    expect(resultado.filas).toHaveLength(2);
    expect(resultado.filas[0]).toMatchObject({
      fecha: "2026-01-15",
      tipo: "withdrawal",
      monto: 850.25,
    });
    expect(resultado.filas[1]).toMatchObject({
      fecha: "2026-01-16",
      tipo: "interest",
      monto: 12.1,
    });
  });

  it("traduce montos negativos a retiros y positivos a depósitos", () => {
    const csv = [
      "2026-02-01,Pago tarjeta,,, -450.75",
      "2026-02-02,Transferencia recibida,,,1250.00",
    ].join("\n");

    const resultado = parsearExtractoCsv(csv);

    expect(resultado.errores).toEqual([]);
    expect(resultado.filas[0]).toMatchObject({
      tipo: "withdrawal",
      monto: 450.75,
    });
    expect(resultado.filas[1]).toMatchObject({
      tipo: "deposit",
      monto: 1250,
    });
  });

  it("respeta el tipo explícito aunque el monto venga en negativo", () => {
    const csv = "2026-03-10,Comisión bancaria,COM-1,comision,-35.00";

    const resultado = parsearExtractoCsv(csv);

    expect(resultado.errores).toEqual([]);
    expect(resultado.filas[0]).toMatchObject({ tipo: "fee", monto: 35 });
  });

  it("acepta filas de cuatro columnas separando referencia o tipo", () => {
    const csv = [
      "2026-04-01,Depósito sucursal,DEP-77,900.00",
      "2026-04-02,Retiro cajero,retiro,120.00",
    ].join("\n");

    const resultado = parsearExtractoCsv(csv);

    expect(resultado.errores).toEqual([]);
    expect(resultado.filas[0]).toMatchObject({
      referencia: "DEP-77",
      tipo: "deposit",
      monto: 900,
    });
    expect(resultado.filas[1]).toMatchObject({
      referencia: "",
      tipo: "withdrawal",
      monto: 120,
    });
  });

  it("respeta comas dentro de campos entre comillas", () => {
    const csv =
      '2026-05-05,"Pago factura 12, sucursal norte",REF-1,retiro,100.00';

    const resultado = parsearExtractoCsv(csv);

    expect(resultado.errores).toEqual([]);
    expect(resultado.filas[0]).toMatchObject({
      descripcion: "Pago factura 12, sucursal norte",
      monto: 100,
    });
  });

  it("reporta fechas inválidas con su número de línea", () => {
    const csv = [
      "fecha,descripcion,referencia,tipo,monto",
      "2026-02-30,Día inexistente,,deposito,10.00",
      "31/13/2026,Mes inexistente,,deposito,10.00",
      "no-es-fecha,Texto,,deposito,10.00",
      "2026-06-01,Válida,,deposito,10.00",
    ].join("\n");

    const resultado = parsearExtractoCsv(csv);

    expect(resultado.filas).toHaveLength(1);
    expect(resultado.errores).toHaveLength(3);
    expect(resultado.errores[0]).toContain("Línea 2");
    expect(resultado.errores[1]).toContain("Línea 3");
    expect(resultado.errores[2]).toContain("Línea 4");
  });

  it("reporta montos inválidos, montos en cero y tipos desconocidos", () => {
    const csv = [
      "2026-06-01,Monto roto,,deposito,abc",
      "2026-06-02,Monto cero,,deposito,0",
      "2026-06-03,Tipo raro,,desconocido,15.00",
      "2026-06-04,Fila corta",
    ].join("\n");

    const resultado = parsearExtractoCsv(csv);

    expect(resultado.filas).toEqual([]);
    expect(resultado.errores).toHaveLength(4);
    expect(resultado.errores[0]).toContain("monto inválido");
    expect(resultado.errores[1]).toContain("no puede ser cero");
    expect(resultado.errores[2]).toContain("tipo de movimiento desconocido");
    expect(resultado.errores[3]).toContain("al menos 4 columnas");
  });

  it("devuelve error cuando el archivo está vacío", () => {
    const resultado = parsearExtractoCsv("   \n\n");

    expect(resultado.filas).toEqual([]);
    expect(resultado.errores).toEqual(["El archivo está vacío."]);
  });
});

describe("bancos: normalización de fechas y montos", () => {
  it("acepta aaaa-mm-dd y dd/mm/aaaa", () => {
    expect(parsearFechaExtracto("2026-11-24")).toBe("2026-11-24");
    expect(parsearFechaExtracto("24/11/2026")).toBe("2026-11-24");
    expect(parsearFechaExtracto("24-11-2026")).toBe("2026-11-24");
    expect(parsearFechaExtracto("2026-13-01")).toBeNull();
    expect(parsearFechaExtracto("31/02/2026")).toBeNull();
  });

  it("interpreta separadores de miles y símbolos de moneda", () => {
    expect(parsearMontoExtracto("RD$ 1,250.00")).toBe(1250);
    expect(parsearMontoExtracto("1.234,56")).toBe(1234.56);
    expect(parsearMontoExtracto("1,234")).toBe(1234);
    expect(parsearMontoExtracto("12,5")).toBe(12.5);
    expect(parsearMontoExtracto("(500.00)")).toBe(-500);
    expect(parsearMontoExtracto("-99.99")).toBe(-99.99);
    expect(parsearMontoExtracto("US$ 10")).toBe(10);
    expect(parsearMontoExtracto("")).toBeNull();
    expect(parsearMontoExtracto("n/a")).toBeNull();
  });
});
