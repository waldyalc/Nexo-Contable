import { createHash } from "node:crypto";
import { z } from "zod";

/**
 * Utilidades puras para la migración SQLite → Supabase.
 *
 * Regla del repositorio público: aquí nunca se leen ni escriben datos reales.
 * Todo lo que cruza estas funciones trabaja con centavos enteros y cadenas
 * sintéticas para evitar errores de punto flotante IEEE-754.
 */

export const ROLES_GLOBALES = ["admin_global", "usuario"] as const;
export const ROLES_EMPRESA = [
  "admin_empresa",
  "contador",
  "auxiliar",
  "cliente",
] as const;

export type RolGlobal = (typeof ROLES_GLOBALES)[number];
export type RolEmpresa = (typeof ROLES_EMPRESA)[number];

const esquemaEmpresaUsuario = z.object({
  rnc_o_nombre: z.string().trim().min(1, "rnc_o_nombre no puede estar vacío"),
  rol: z.enum(ROLES_EMPRESA),
  es_principal: z.boolean().optional(),
});

const esquemaUsuario = z.object({
  email: z.string().trim().email("correo inválido"),
  nombre: z.string().trim().min(1, "nombre no puede estar vacío"),
  rol_global: z.enum(ROLES_GLOBALES),
  empresas: z.array(esquemaEmpresaUsuario).optional(),
});

const esquemaConfigUsuarios = z.object({
  usuarios: z.array(esquemaUsuario).min(1, "debe declarar al menos un usuario"),
});

export type ConfigUsuarioEmpresa = z.infer<typeof esquemaEmpresaUsuario>;
export type ConfigUsuario = z.infer<typeof esquemaUsuario>;
export type ConfigUsuarios = z.infer<typeof esquemaConfigUsuarios>;

export interface LineaPartidaDoble {
  debitoCents: bigint;
  creditoCents: bigint;
}

export interface ResultadoPartidaDoble {
  valido: boolean;
  totalDebitoCents: bigint;
  totalCreditoCents: bigint;
  errores: string[];
}

const ENTERO_CON_SIGNO = /^[+-]?\d+$/;
const DECIMAL_MONETARIO = /^([+-]?)(\d+)(?:\.(\d{1,2}))?$/;

function aBigIntEntero(
  valor: number | bigint | string | null | undefined,
): bigint {
  if (valor === null || valor === undefined) return 0n;

  if (typeof valor === "bigint") return valor;

  if (typeof valor === "number") {
    if (!Number.isFinite(valor) || !Number.isInteger(valor)) {
      throw new Error(`Se esperaban centavos enteros y se recibió ${valor}`);
    }
    return BigInt(valor);
  }

  const limpio = valor.trim();
  if (limpio === "") return 0n;
  if (!ENTERO_CON_SIGNO.test(limpio)) {
    throw new Error(`Se esperaban centavos enteros y se recibió "${valor}"`);
  }
  return BigInt(limpio);
}

/**
 * Convierte centavos enteros a una cadena decimal exacta con dos decimales.
 * BigInt evita cualquier pérdida por punto flotante, incluso por encima de
 * `Number.MAX_SAFE_INTEGER`.
 */
export function centavosADecimal(
  centavos: number | bigint | string | null | undefined,
): string {
  const valor = aBigIntEntero(centavos);
  const negativo = valor < 0n;
  const absoluto = negativo ? -valor : valor;
  const enteros = absoluto / 100n;
  const resto = absoluto % 100n;
  const decimales = resto.toString().padStart(2, "0");
  return `${negativo ? "-" : ""}${enteros.toString()}.${decimales}`;
}

/**
 * Convierte un monto decimal (por ejemplo `numeric` de PostgreSQL, que llega
 * como string) a centavos enteros sin pasar por punto flotante.
 */
export function decimalACentavos(
  valor: string | number | bigint | null | undefined,
): bigint {
  if (valor === null || valor === undefined) return 0n;
  if (typeof valor === "bigint") return valor * 100n;

  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) {
      throw new Error(`Monto inválido: ${valor}`);
    }
    return decimalACentavos(String(valor));
  }

  const limpio = valor.trim().replace(/,/g, "");
  if (limpio === "") return 0n;

  const coincidencia = DECIMAL_MONETARIO.exec(limpio);
  if (!coincidencia) {
    throw new Error(`Monto decimal inválido: "${valor}"`);
  }

  const signo = coincidencia[1] === "-" ? -1n : 1n;
  const enteros = BigInt(coincidencia[2] ?? "0");
  const decimales = (coincidencia[3] ?? "").padEnd(2, "0");
  return signo * (enteros * 100n + BigInt(decimales === "" ? "0" : decimales));
}

/**
 * Normaliza un RNC/cédula igual que `public.normalizar_rnc` en PostgreSQL:
 * quita acentos, espacios, guiones y cualquier carácter no alfanumérico, y
 * pasa a mayúsculas.
 */
export function normalizarRnc(rnc: string | null | undefined): string {
  if (!rnc) return "";
  return rnc
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Genera un UUID determinista (formato v5, derivado de SHA-256) para mapear
 * claves de SQLite a identificadores estables en Supabase. La misma llave
 * produce siempre el mismo UUID, lo que hace idempotente la migración.
 */
export function uuidDeterminista(espacio: string, clave: string): string {
  const hash = createHash("sha256")
    .update(`${espacio}:${clave}`, "utf8")
    .digest("hex");
  const caracteres = hash.slice(0, 32).split("");
  caracteres[12] = "5";
  const variante = (Number.parseInt(caracteres[16] ?? "0", 16) & 0x3) | 0x8;
  caracteres[16] = variante.toString(16);
  const hex = caracteres.join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/**
 * Valida la partida doble de un asiento antes de escribir en Supabase.
 * Exige al menos dos líneas, montos no negativos, un solo lado por línea y
 * `SUM(debito) === SUM(credito)` al centavo.
 */
export function validarPartidaDoble(
  lineas: LineaPartidaDoble[],
): ResultadoPartidaDoble {
  const errores: string[] = [];
  let totalDebitoCents = 0n;
  let totalCreditoCents = 0n;

  if (lineas.length < 2) {
    errores.push(
      `El asiento requiere al menos 2 líneas (tiene ${lineas.length})`,
    );
  }

  lineas.forEach((linea, indice) => {
    if (linea.debitoCents < 0n || linea.creditoCents < 0n) {
      errores.push(`La línea ${indice + 1} tiene montos negativos`);
    }
    if (linea.debitoCents > 0n && linea.creditoCents > 0n) {
      errores.push(`La línea ${indice + 1} registra débito y crédito a la vez`);
    }
    if (linea.debitoCents === 0n && linea.creditoCents === 0n) {
      errores.push(`La línea ${indice + 1} no tiene débito ni crédito`);
    }
    totalDebitoCents += linea.debitoCents;
    totalCreditoCents += linea.creditoCents;
  });

  if (totalDebitoCents !== totalCreditoCents) {
    errores.push(
      `Descuadre: débitos ${centavosADecimal(totalDebitoCents)} vs créditos ${centavosADecimal(totalCreditoCents)}`,
    );
  }

  return {
    valido: errores.length === 0,
    totalDebitoCents,
    totalCreditoCents,
    errores,
  };
}

/**
 * Valida el JSON local de usuarios iniciales (por ejemplo
 * `work/usuarios-iniciales.json`). Los correos deben ser sintéticos; el
 * script no envía correos ni crea contraseñas visibles.
 */
export function parsearConfigUsuarios(json: unknown): ConfigUsuarios {
  const resultado = esquemaConfigUsuarios.safeParse(json);
  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((issue) => `${issue.path.join(".") || "config"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Configuración de usuarios inválida: ${detalle}`);
  }

  const vistos = new Set<string>();
  for (const usuario of resultado.data.usuarios) {
    const correo = usuario.email.toLowerCase();
    if (vistos.has(correo)) {
      throw new Error(`Correo duplicado en la configuración: ${usuario.email}`);
    }
    vistos.add(correo);
  }

  return resultado.data;
}
