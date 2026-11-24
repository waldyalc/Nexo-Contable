import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import type { Page } from "@playwright/test";

/**
 * Credenciales y sesión de QA compartidas por las pruebas Playwright y por
 * `scripts/captura-todas.ts`.
 *
 * - Las credenciales se leen de `QA_USER`/`QA_PASS` (o `ZZTEST_USER`/
 *   `ZZTEST_PASS`) y, si no están, de `.env.pruebas` en el checkout actual o en
 *   el checkout principal del worktree. Jamás se escriben en el repositorio.
 * - El `storageState` vive fuera del repo (`~/.nexo-contable/storage-qa.json`
 *   o `NEXO_STORAGE_STATE`), así una sola sesión QA sirve para toda la suite.
 */

export const ARCHIVO_ENV_PRUEBAS = ".env.pruebas";

const RUTA_STORAGE_POR_DEFECTO = join(
  homedir(),
  ".nexo-contable",
  "storage-qa.json",
);

export interface CredencialesQa {
  usuario: string;
  clave: string;
}

function leerArchivoEnv(archivo: string): Record<string, string> {
  const valores: Record<string, string> = {};

  for (const linea of readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const coincidencia = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(linea);
    if (!coincidencia) continue;

    const clave = coincidencia[1];
    const valor = coincidencia[2];
    if (clave === undefined || valor === undefined) continue;

    valores[clave] = valor.replace(/^["']|["']$/g, "");
  }

  return valores;
}

/** Checkout principal del repositorio (los worktrees comparten `.env.pruebas`). */
function checkoutPrincipal(): string {
  try {
    const comun = execFileSync("git", ["rev-parse", "--git-common-dir"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return dirname(resolve(comun));
  } catch {
    return process.cwd();
  }
}

/** Credenciales QA del entorno o de `.env.pruebas`; `null` si no existen. */
export function credencialesQa(): CredencialesQa | null {
  const usuarioEnv = process.env.QA_USER ?? process.env.ZZTEST_USER;
  const claveEnv = process.env.QA_PASS ?? process.env.ZZTEST_PASS;

  if (usuarioEnv && claveEnv) {
    return { usuario: usuarioEnv, clave: claveEnv };
  }

  const candidatos = [
    join(process.cwd(), ARCHIVO_ENV_PRUEBAS),
    join(checkoutPrincipal(), ARCHIVO_ENV_PRUEBAS),
  ];

  for (const archivo of candidatos) {
    if (!existsSync(archivo)) continue;

    const valores = leerArchivoEnv(archivo);
    const usuario = valores.QA_USER ?? valores.ZZTEST_USER;
    const clave = valores.QA_PASS ?? valores.ZZTEST_PASS;

    if (usuario && clave) {
      return { usuario, clave };
    }
  }

  return null;
}

/** Ruta del `storageState` QA, siempre fuera del repositorio. */
export function rutaStorageState(): string {
  const ruta = process.env.NEXO_STORAGE_STATE ?? RUTA_STORAGE_POR_DEFECTO;
  mkdirSync(dirname(ruta), { recursive: true, mode: 0o700 });
  return ruta;
}

/** Inicia sesión en `/login` con las credenciales QA indicadas. */
export async function autenticar(
  page: Page,
  credenciales: CredencialesQa,
): Promise<void> {
  await page.goto("/login", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.getByLabel(/correo/i).fill(credenciales.usuario);
  await page.locator('input[type="password"]').first().fill(credenciales.clave);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.waitForURL(/\/(dashboard|empresas|definir-password)/, {
    timeout: 60_000,
  });
}
