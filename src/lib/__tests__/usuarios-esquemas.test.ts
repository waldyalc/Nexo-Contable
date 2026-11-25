import { describe, expect, it } from "vitest";

import {
  esquemaCrearUsuario,
  esquemaRestablecerPasswordUsuario,
} from "@/app/(app)/usuarios/esquemas";

const EMPRESA_ID = "550e8400-e29b-41d4-a716-446655440000";
const USER_ID = "650e8400-e29b-41d4-a716-446655440000";

function datosCreacionValidos() {
  return {
    nombre: "  Usuario de Prueba  ",
    email: "  USUARIO@Example.com ",
    password: "clave-super-segura-123",
    rolGlobal: "usuario",
    activo: true,
    empresas: [{ empresaId: EMPRESA_ID, rol: "contador" }],
  };
}

describe("schemas de server actions de usuarios", () => {
  it("normaliza el payload de creación antes de invocar la edge function", () => {
    const resultado = esquemaCrearUsuario.safeParse(datosCreacionValidos());

    expect(resultado.success).toBe(true);
    if (!resultado.success) return;

    expect(resultado.data.nombre).toBe("Usuario de Prueba");
    expect(resultado.data.email).toBe("usuario@example.com");
    expect(resultado.data.empresas).toEqual([
      { empresaId: EMPRESA_ID, rol: "contador" },
    ]);
  });

  it.each([
    ["correo inválido", { email: "sin-arroba" }],
    ["contraseña corta", { password: "12345678901" }],
    ["contraseña unicode corta", { password: "𝔸".repeat(6) }],
    ["contraseña demasiado larga", { password: "x".repeat(73) }],
    ["contraseña unicode demasiado larga", { password: "𝔸".repeat(19) }],
    ["nombre vacío", { nombre: "   " }],
    ["rol global inválido", { rolGlobal: "superadmin" }],
    [
      "rol de empresa inválido",
      { empresas: [{ empresaId: EMPRESA_ID, rol: "dueño" }] },
    ],
    [
      "empresas repetidas",
      {
        empresas: [
          { empresaId: EMPRESA_ID, rol: "contador" },
          { empresaId: EMPRESA_ID.toUpperCase(), rol: "cliente" },
        ],
      },
    ],
  ])("rechaza %s", (_caso, cambios) => {
    const resultado = esquemaCrearUsuario.safeParse({
      ...datosCreacionValidos(),
      ...cambios,
    });

    expect(resultado.success).toBe(false);
  });

  it("valida el payload de restablecimiento", () => {
    const valido = esquemaRestablecerPasswordUsuario.safeParse({
      userId: USER_ID,
      password: "123456789012",
    });
    expect(valido.success).toBe(true);

    const invalido = esquemaRestablecerPasswordUsuario.safeParse({
      userId: USER_ID,
      password: "12345678901",
    });
    expect(invalido.success).toBe(false);
  });
});
