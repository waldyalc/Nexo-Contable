import { describe, expect, it } from "vitest";

import {
  validarPayloadCrearUsuario,
  validarPayloadRestablecerPassword,
} from "../../../supabase/functions/_shared/admin-usuarios-validacion";

const EMPRESA_ID = "550e8400-e29b-41d4-a716-446655440000";
const USER_ID = "650e8400-e29b-41d4-a716-446655440000";

function payloadCreacionValido() {
  return {
    email: "  USUARIO@Example.com ",
    password: "clave-super-segura-123",
    nombre: "  Usuario de Prueba  ",
    rol_global: "usuario",
    activo: true,
    empresas: [{ empresa_id: EMPRESA_ID.toUpperCase(), rol: "contador" }],
  };
}

describe("validación edge admin-usuarios: crear usuario", () => {
  it("normaliza correo, nombre y empresas válidas", () => {
    const resultado = validarPayloadCrearUsuario(payloadCreacionValido());

    if (!resultado.ok) throw new Error(resultado.error);

    expect(resultado.datos).toEqual({
      email: "usuario@example.com",
      password: "clave-super-segura-123",
      nombre: "Usuario de Prueba",
      rol_global: "usuario",
      activo: true,
      empresas: [{ empresa_id: EMPRESA_ID, rol: "contador" }],
    });
  });

  it("permite crear sin empresas y usa una lista vacía", () => {
    const payload = payloadCreacionValido() as Record<string, unknown>;
    payload.empresas = undefined;

    const resultado = validarPayloadCrearUsuario(payload);

    if (!resultado.ok) throw new Error(resultado.error);
    expect(resultado.datos.empresas).toEqual([]);
  });

  it.each([
    ["correo inválido", { email: "sin-arroba" }],
    ["correo sin dominio completo", { email: "usuario@localhost" }],
    ["correo con puntos inválidos", { email: "usuario..doble@example.com" }],
    ["contraseña corta", { password: "12345678901" }],
    ["contraseña unicode corta", { password: "𝔸".repeat(6) }],
    ["contraseña demasiado larga", { password: "x".repeat(73) }],
    ["contraseña unicode demasiado larga", { password: "𝔸".repeat(19) }],
    ["nombre vacío", { nombre: "   " }],
    ["rol global inválido", { rol_global: "superadmin" }],
    ["estado no booleano", { activo: "true" }],
    [
      "rol de empresa inválido",
      { empresas: [{ empresa_id: EMPRESA_ID, rol: "dueño" }] },
    ],
    [
      "empresa inválida",
      { empresas: [{ empresa_id: "no-uuid", rol: "contador" }] },
    ],
    [
      "empresa repetida",
      {
        empresas: [
          { empresa_id: EMPRESA_ID, rol: "contador" },
          { empresa_id: EMPRESA_ID.toUpperCase(), rol: "cliente" },
        ],
      },
    ],
  ])("rechaza %s", (_caso, cambios) => {
    const resultado = validarPayloadCrearUsuario({
      ...payloadCreacionValido(),
      ...cambios,
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.length).toBeGreaterThan(0);
  });
});

describe("validación edge admin-usuarios: restablecer contraseña", () => {
  it("acepta un usuario UUID y una contraseña de 12+ caracteres", () => {
    const resultado = validarPayloadRestablecerPassword({
      user_id: USER_ID,
      password: "123456789012",
    });

    if (!resultado.ok) throw new Error(resultado.error);
    expect(resultado.datos).toEqual({
      user_id: USER_ID,
      password: "123456789012",
    });
  });

  it.each([
    ["usuario inválido", { user_id: "abc" }],
    ["contraseña corta", { password: "12345678901" }],
    ["contraseña demasiado larga", { password: "x".repeat(73) }],
    ["contraseña ausente", { password: undefined }],
  ])("rechaza %s", (_caso, cambios) => {
    const resultado = validarPayloadRestablecerPassword({
      user_id: USER_ID,
      password: "123456789012",
      ...cambios,
    });

    expect(resultado.ok).toBe(false);
  });
});
