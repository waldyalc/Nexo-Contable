import { describe, expect, it } from "vitest";

import { generarPasswordSegura } from "@/components/usuarios/generar-password";

const MINUSCULAS = "abcdefghijkmnpqrstuvwxyz";
const MAYUSCULAS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITOS = "23456789";
const SIMBOLOS = "!@#$%&*()-_=+";
const PERMITIDOS = new Set(
  `${MINUSCULAS}${MAYUSCULAS}${DIGITOS}${SIMBOLOS}`.split(""),
);

describe("generarPasswordSegura", () => {
  it("genera 16 caracteres por defecto con todos los grupos requeridos", () => {
    const password = generarPasswordSegura();

    expect(password).toHaveLength(16);
    expect([...password].every((caracter) => PERMITIDOS.has(caracter))).toBe(
      true,
    );
    expect(
      [...password].some((caracter) => MINUSCULAS.includes(caracter)),
    ).toBe(true);
    expect(
      [...password].some((caracter) => MAYUSCULAS.includes(caracter)),
    ).toBe(true);
    expect([...password].some((caracter) => DIGITOS.includes(caracter))).toBe(
      true,
    );
    expect([...password].some((caracter) => SIMBOLOS.includes(caracter))).toBe(
      true,
    );
  });

  it("respeta longitudes personalizadas dentro del rango permitido", () => {
    expect(generarPasswordSegura(12)).toHaveLength(12);
    expect(generarPasswordSegura(32)).toHaveLength(32);
  });

  it.each([0, 8, 11, 129, 12.5])("rechaza longitud inválida %s", (longitud) => {
    expect(() => generarPasswordSegura(longitud)).toThrow(
      "La longitud de la contraseña debe estar entre 12 y 128.",
    );
  });
});
