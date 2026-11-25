export const ROLES_GLOBALES = ["admin_global", "usuario"] as const;
export const ROLES_EMPRESA = [
  "admin_empresa",
  "contador",
  "auxiliar",
  "cliente",
] as const;

export type RolGlobalValido = (typeof ROLES_GLOBALES)[number];
export type RolEmpresaValido = (typeof ROLES_EMPRESA)[number];

export interface AsignacionEmpresaPayload {
  empresa_id: string;
  rol: RolEmpresaValido;
}

export interface CrearUsuarioPayload {
  email: string;
  password: string;
  nombre: string;
  rol_global: RolGlobalValido;
  activo: boolean;
  empresas: AsignacionEmpresaPayload[];
}

export interface RestablecerPasswordPayload {
  user_id: string;
  password: string;
}

export type ResultadoValidacion<T> =
  | { ok: true; datos: T }
  | { ok: false; error: string };

const RE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RE_LOCAL_EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
const RE_ETIQUETA_DOMINIO = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const LONGITUD_MAXIMA_PASSWORD_BYTES = 72;

function esEmailValido(email: string): boolean {
  const partes = email.split("@");
  if (partes.length !== 2) return false;

  const local = partes[0] ?? "";
  const dominio = partes[1] ?? "";
  if (
    local.length === 0 ||
    local.length > 64 ||
    dominio.length === 0 ||
    dominio.length > 253 ||
    !RE_LOCAL_EMAIL.test(local) ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    dominio.includes("..")
  ) {
    return false;
  }

  const etiquetas = dominio.split(".");
  return (
    etiquetas.length >= 2 &&
    etiquetas.every((etiqueta) => RE_ETIQUETA_DOMINIO.test(etiqueta))
  );
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function esRolGlobal(valor: unknown): valor is RolGlobalValido {
  return (
    typeof valor === "string" &&
    (ROLES_GLOBALES as readonly string[]).includes(valor)
  );
}

function esRolEmpresa(valor: unknown): valor is RolEmpresaValido {
  return (
    typeof valor === "string" &&
    (ROLES_EMPRESA as readonly string[]).includes(valor)
  );
}

function validarPassword(valor: unknown): ResultadoValidacion<string> {
  if (typeof valor !== "string" || Array.from(valor).length < 12) {
    return {
      ok: false,
      error: "La contraseña debe tener al menos 12 caracteres.",
    };
  }
  if (new TextEncoder().encode(valor).length > LONGITUD_MAXIMA_PASSWORD_BYTES) {
    return {
      ok: false,
      error: "La contraseña no puede superar 72 caracteres.",
    };
  }
  return { ok: true, datos: valor };
}

function validarUuid(
  valor: unknown,
  etiqueta: string,
): ResultadoValidacion<string> {
  if (typeof valor !== "string" || !RE_UUID.test(valor)) {
    return { ok: false, error: `${etiqueta} inválido.` };
  }
  return { ok: true, datos: valor };
}

export function validarPayloadCrearUsuario(
  payload: unknown,
): ResultadoValidacion<CrearUsuarioPayload> {
  if (!esObjeto(payload)) {
    return { ok: false, error: "El cuerpo de creación debe ser un objeto." };
  }

  const emailCrudo = payload.email;
  if (typeof emailCrudo !== "string") {
    return { ok: false, error: "El correo es obligatorio." };
  }
  const email = emailCrudo.trim().toLowerCase();
  if (email.length === 0 || email.length > 320 || !esEmailValido(email)) {
    return { ok: false, error: "El correo no tiene un formato válido." };
  }

  const passwordValidada = validarPassword(payload.password);
  if (!passwordValidada.ok) return passwordValidada;

  const nombreCrudo = payload.nombre;
  if (typeof nombreCrudo !== "string") {
    return { ok: false, error: "El nombre es obligatorio." };
  }
  const nombre = nombreCrudo.trim();
  if (nombre.length === 0) {
    return { ok: false, error: "El nombre es obligatorio." };
  }
  if (nombre.length > 160) {
    return { ok: false, error: "El nombre no puede superar 160 caracteres." };
  }

  if (!esRolGlobal(payload.rol_global)) {
    return { ok: false, error: "El rol global es inválido." };
  }

  if (typeof payload.activo !== "boolean") {
    return { ok: false, error: "El estado activo debe ser verdadero o falso." };
  }

  const empresasCrudas = payload.empresas ?? [];
  if (!Array.isArray(empresasCrudas)) {
    return { ok: false, error: "Las empresas deben enviarse como una lista." };
  }
  if (empresasCrudas.length > 100) {
    return { ok: false, error: "No se pueden asignar más de 100 empresas." };
  }

  const empresas: AsignacionEmpresaPayload[] = [];
  const idsVistos = new Set<string>();

  for (const empresaCruda of empresasCrudas) {
    if (!esObjeto(empresaCruda)) {
      return {
        ok: false,
        error: "Cada asignación de empresa debe ser un objeto.",
      };
    }

    const empresaIdValidada = validarUuid(
      empresaCruda.empresa_id,
      "La empresa",
    );
    if (!empresaIdValidada.ok) return empresaIdValidada;

    if (!esRolEmpresa(empresaCruda.rol)) {
      return { ok: false, error: "El rol de empresa es inválido." };
    }

    const empresaId = empresaIdValidada.datos.toLowerCase();
    if (idsVistos.has(empresaId)) {
      return {
        ok: false,
        error: "No repitas la misma empresa en la asignación.",
      };
    }
    idsVistos.add(empresaId);

    empresas.push({ empresa_id: empresaId, rol: empresaCruda.rol });
  }

  return {
    ok: true,
    datos: {
      email,
      password: passwordValidada.datos,
      nombre,
      rol_global: payload.rol_global,
      activo: payload.activo,
      empresas,
    },
  };
}

export function validarPayloadRestablecerPassword(
  payload: unknown,
): ResultadoValidacion<RestablecerPasswordPayload> {
  if (!esObjeto(payload)) {
    return {
      ok: false,
      error: "El cuerpo de restablecimiento debe ser un objeto.",
    };
  }

  const userIdValidado = validarUuid(payload.user_id, "El usuario");
  if (!userIdValidado.ok) return userIdValidado;

  const passwordValidada = validarPassword(payload.password);
  if (!passwordValidada.ok) return passwordValidada;

  return {
    ok: true,
    datos: {
      user_id: userIdValidado.datos,
      password: passwordValidada.datos,
    },
  };
}
