import { describe, expect, it } from "vitest";

import { parsearMatrizBalances } from "@/components/contabilidad/balances-iniciales-utils";

describe("parsearMatrizBalances", () => {
  it("acepta encabezados del sistema original y montos dominicanos", () => {
    const resultado = parsearMatrizBalances([
      ["account_code", "debit", "credit", "description"],
      ["1101", "1,250.50", "0", "Caja"],
      ["3101", "0", "1,250.50", "Capital"],
    ]);

    expect(resultado.errores).toEqual([]);
    expect(resultado.filas).toEqual([
      { codigo: "1101", debito: 1250.5, credito: 0, descripcion: "Caja" },
      { codigo: "3101", debito: 0, credito: 1250.5, descripcion: "Capital" },
    ]);
  });

  it("rechaza filas con débito y crédito a la vez", () => {
    const resultado = parsearMatrizBalances([
      ["cuenta", "débito", "crédito"],
      ["1101", "100", "100"],
    ]);

    expect(resultado.filas).toEqual([]);
    expect(resultado.errores[0]).toContain("nunca ambos");
  });

  it("exige las tres columnas principales", () => {
    const resultado = parsearMatrizBalances([["cuenta", "detalle"]]);
    expect(resultado.errores[0]).toContain("cuenta, débito y crédito");
  });
});
