import { describe, expect, it } from "vitest";

import {
  formatearCantidad,
  formatearFecha,
  formatearMoneda,
  formatearPeriodoMes,
  formatearRnc,
  hoySantoDomingo,
  normalizarRnc,
  periodoActualSantoDomingo,
} from "@/lib/formato";

describe("formato: moneda y cantidades", () => {
  it("formatea montos en DOP y USD con separadores es-DO", () => {
    expect(formatearMoneda(1250)).toBe("RD$ 1,250.00");
    expect(formatearMoneda("1250", "DOP")).toBe("RD$ 1,250.00");
    expect(formatearMoneda(100, "USD")).toBe("US$ 100.00");
  });

  it("coloca el signo negativo antes del símbolo de moneda", () => {
    expect(formatearMoneda(-1250)).toBe("-RD$ 1,250.00");
    expect(formatearMoneda("-99.5", "USD")).toBe("-US$ 99.50");
  });

  it("formatea cantidades con los decimales indicados", () => {
    expect(formatearCantidad(1234.5678)).toBe("1,234.57");
    expect(formatearCantidad("12.5", 4)).toBe("12.5000");
    expect(formatearCantidad(0, 0)).toBe("0");
  });
});

describe("formato: fechas y periodos", () => {
  it("convierte fechas ISO a dd/MM/yyyy sin desfase de zona horaria", () => {
    expect(formatearFecha("2026-11-24")).toBe("24/11/2026");
    expect(formatearFecha("2026-11-24T23:59:59-04:00")).toBe("24/11/2026");
    expect(formatearFecha("")).toBe("");
    expect(formatearFecha("no-es-fecha")).toBe("");
  });

  it("convierte yyyy-MM a un periodo legible en español", () => {
    expect(formatearPeriodoMes("2026-11")).toBe("noviembre de 2026");
    expect(formatearPeriodoMes("2027-01")).toBe("enero de 2027");
    expect(formatearPeriodoMes("2026-13")).toBe("");
    expect(formatearPeriodoMes("")).toBe("");
  });

  it("calcula hoy y el periodo actual en America/Santo_Domingo", () => {
    expect(formatearFecha(hoySantoDomingo())).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(periodoActualSantoDomingo()).toMatch(/^\d{4}-\d{2}$/);

    // 03:00 UTC del 25/11 ya es el 24/11 a las 23:00 en Santo Domingo (UTC-4).
    const tarde = new Date("2026-11-25T03:00:00Z");
    expect(hoySantoDomingo(tarde)).toBe("2026-11-24");
    expect(periodoActualSantoDomingo(tarde)).toBe("2026-11");

    // 02:00 UTC del 01/01/2027 sigue siendo diciembre de 2026 en Santo Domingo.
    const finDeAnio = new Date("2027-01-01T02:00:00Z");
    expect(hoySantoDomingo(finDeAnio)).toBe("2026-12-31");
    expect(periodoActualSantoDomingo(finDeAnio)).toBe("2026-12");
  });
});

describe("formato: RNC y cédula", () => {
  it("normaliza guiones y espacios", () => {
    expect(normalizarRnc("1-01-12345-6")).toBe("101123456");
    expect(normalizarRnc(" 001 1234567 8 ")).toBe("00112345678");
    expect(normalizarRnc("")).toBe("");
  });

  it("formatea RNC de 9 dígitos y cédula de 11 dígitos", () => {
    expect(formatearRnc("101123456")).toBe("101-12345-6");
    expect(formatearRnc("1-01-12345-6")).toBe("101-12345-6");
    expect(formatearRnc("00112345678")).toBe("001-1234567-8");
  });

  it("devuelve los dígitos cuando la longitud no es válida", () => {
    expect(formatearRnc("123")).toBe("123");
  });
});
