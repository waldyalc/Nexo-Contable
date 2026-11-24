import { describe, expect, it } from "vitest";
import {
  centavosADecimal,
  decimalACentavos,
  normalizarRnc,
  parsearConfigUsuarios,
  uuidDeterminista,
  validarPartidaDoble,
} from "../../../scripts/lib/migracion-utils";

describe("centavosADecimal", () => {
  it("convierte centavos positivos con dos decimales", () => {
    expect(centavosADecimal(123456)).toBe("1234.56");
    expect(centavosADecimal(100)).toBe("1.00");
    expect(centavosADecimal(1)).toBe("0.01");
    expect(centavosADecimal(0)).toBe("0.00");
  });

  it("convierte centavos negativos sin perder el signo", () => {
    expect(centavosADecimal(-50)).toBe("-0.50");
    expect(centavosADecimal(-123456)).toBe("-1234.56");
    expect(centavosADecimal(-1)).toBe("-0.01");
  });

  it("es exacto con montos por encima de Number.MAX_SAFE_INTEGER", () => {
    expect(centavosADecimal(9007199254740993n)).toBe("90071992547409.93");
    expect(centavosADecimal("-9007199254740993")).toBe("-90071992547409.93");
    expect(centavosADecimal(123456789012345678901234567890n)).toBe(
      "1234567890123456789012345678.90",
    );
  });

  it("trata null y undefined como cero", () => {
    expect(centavosADecimal(null)).toBe("0.00");
    expect(centavosADecimal(undefined)).toBe("0.00");
    expect(centavosADecimal("")).toBe("0.00");
  });

  it("rechaza números no enteros y cadenas inválidas", () => {
    expect(() => centavosADecimal(12.5)).toThrow();
    expect(() => centavosADecimal(Number.NaN)).toThrow();
    expect(() => centavosADecimal(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => centavosADecimal("1234.56")).toThrow();
    expect(() => centavosADecimal("abc")).toThrow();
  });
});

describe("decimalACentavos", () => {
  it("convierte decimales de PostgreSQL a centavos exactos", () => {
    expect(decimalACentavos("1234.56")).toBe(123456n);
    expect(decimalACentavos("-0.50")).toBe(-50n);
    expect(decimalACentavos("0")).toBe(0n);
    expect(decimalACentavos("10.5")).toBe(1050n);
    expect(decimalACentavos(100.25)).toBe(10025n);
    expect(decimalACentavos(null)).toBe(0n);
  });

  it("acepta separadores de miles y rechaza formatos inválidos", () => {
    expect(decimalACentavos("1,234.56")).toBe(123456n);
    expect(() => decimalACentavos("12.345")).toThrow();
    expect(() => decimalACentavos("abc")).toThrow();
  });

  it("es inverso de centavosADecimal", () => {
    for (const centavos of [0n, 1n, 99n, 100n, -50n, 123456789012345n]) {
      expect(decimalACentavos(centavosADecimal(centavos))).toBe(centavos);
    }
  });
});

describe("normalizarRnc", () => {
  it("quita guiones, espacios y puntos y pasa a mayúsculas", () => {
    expect(normalizarRnc("1-01-12345-6")).toBe("101123456");
    expect(normalizarRnc(" 1 01 12345 6 ")).toBe("101123456");
    expect(normalizarRnc("1.01.12345.6")).toBe("101123456");
    expect(normalizarRnc("abc-123")).toBe("ABC123");
  });

  it("elimina acentos y devuelve cadena vacía para nulos", () => {
    expect(normalizarRnc("cédula-001")).toBe("CEDULA001");
    expect(normalizarRnc(null)).toBe("");
    expect(normalizarRnc(undefined)).toBe("");
    expect(normalizarRnc("")).toBe("");
  });
});

describe("uuidDeterminista", () => {
  it("es estable para la misma llave y cambia entre llaves", () => {
    const primero = uuidDeterminista("empresa", "rnc:101123456");
    const segundo = uuidDeterminista("empresa", "rnc:101123456");
    const tercero = uuidDeterminista("empresa", "rnc:202123456");

    expect(primero).toBe(segundo);
    expect(primero).not.toBe(tercero);
  });

  it("produce UUID con versión 5 y variante RFC 4122", () => {
    const uuid = uuidDeterminista("cuenta", "empresa:1.1.01");
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe("validarPartidaDoble", () => {
  it("acepta un asiento de dos líneas cuadrado", () => {
    const resultado = validarPartidaDoble([
      { debitoCents: 118000n, creditoCents: 0n },
      { debitoCents: 0n, creditoCents: 118000n },
    ]);

    expect(resultado.valido).toBe(true);
    expect(resultado.errores).toEqual([]);
    expect(resultado.totalDebitoCents).toBe(118000n);
    expect(resultado.totalCreditoCents).toBe(118000n);
  });

  it("acepta asientos de varias líneas que cuadran", () => {
    const resultado = validarPartidaDoble([
      { debitoCents: 100000n, creditoCents: 0n },
      { debitoCents: 18000n, creditoCents: 0n },
      { debitoCents: 0n, creditoCents: 10000n },
      { debitoCents: 0n, creditoCents: 108000n },
    ]);

    expect(resultado.valido).toBe(true);
  });

  it("rechaza asientos con menos de dos líneas", () => {
    const resultado = validarPartidaDoble([
      { debitoCents: 100n, creditoCents: 100n },
    ]);

    expect(resultado.valido).toBe(false);
    expect(resultado.errores.join(" ")).toContain("al menos 2 líneas");
  });

  it("detecta descuadres al centavo", () => {
    const resultado = validarPartidaDoble([
      { debitoCents: 10000n, creditoCents: 0n },
      { debitoCents: 0n, creditoCents: 9999n },
    ]);

    expect(resultado.valido).toBe(false);
    expect(resultado.errores.join(" ")).toContain("Descuadre");
  });

  it("rechaza montos negativos, líneas vacías y doble lado", () => {
    const resultado = validarPartidaDoble([
      { debitoCents: -1n, creditoCents: 0n },
      { debitoCents: 0n, creditoCents: 0n },
      { debitoCents: 10n, creditoCents: 10n },
    ]);

    expect(resultado.valido).toBe(false);
    expect(resultado.errores.length).toBeGreaterThanOrEqual(3);
  });

  it("acepta una lista vacía como inválida sin lanzar excepción", () => {
    const resultado = validarPartidaDoble([]);
    expect(resultado.valido).toBe(false);
    expect(resultado.errores).toHaveLength(1);
  });
});

describe("parsearConfigUsuarios", () => {
  const configValida = {
    usuarios: [
      {
        email: "admin@ejemplo.test",
        nombre: "Administrador Demo",
        rol_global: "admin_global",
        empresas: [
          {
            rnc_o_nombre: "101123456",
            rol: "admin_empresa",
            es_principal: true,
          },
        ],
      },
      {
        email: "contador@ejemplo.test",
        nombre: "Contador Demo",
        rol_global: "usuario",
      },
    ],
  };

  it("acepta una configuración sintética válida", () => {
    const config = parsearConfigUsuarios(configValida);
    expect(config.usuarios).toHaveLength(2);
    expect(config.usuarios[0]?.email).toBe("admin@ejemplo.test");
    expect(config.usuarios[0]?.empresas?.[0]?.rol).toBe("admin_empresa");
    expect(config.usuarios[1]?.empresas).toBeUndefined();
  });

  it("rechaza correos duplicados sin importar mayúsculas", () => {
    expect(() =>
      parsearConfigUsuarios({
        usuarios: [
          {
            email: "admin@ejemplo.test",
            nombre: "Uno",
            rol_global: "usuario",
          },
          {
            email: "ADMIN@ejemplo.test",
            nombre: "Dos",
            rol_global: "usuario",
          },
        ],
      }),
    ).toThrow(/duplicado/i);
  });

  it("rechaza roles inválidos y correos mal formados", () => {
    expect(() =>
      parsearConfigUsuarios({
        usuarios: [
          { email: "sin-arroba", nombre: "Demo", rol_global: "usuario" },
        ],
      }),
    ).toThrow(/inválida/i);

    expect(() =>
      parsearConfigUsuarios({
        usuarios: [
          {
            email: "demo@ejemplo.test",
            nombre: "Demo",
            rol_global: "superadmin",
          },
        ],
      }),
    ).toThrow(/inválida/i);
  });

  it("rechaza configuración sin usuarios", () => {
    expect(() => parsearConfigUsuarios({ usuarios: [] })).toThrow(
      /al menos un usuario/i,
    );
    expect(() => parsearConfigUsuarios({})).toThrow(/inválida/i);
    expect(() => parsearConfigUsuarios(null)).toThrow(/inválida/i);
  });
});
