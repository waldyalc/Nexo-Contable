/**
 * pnpm captura-todas — capturas de todas las rutas de Nexo Contable.
 *
 * Uso:
 *   tsx scripts/captura-todas.ts [--base http://127.0.0.1:3020] [--salida .capturas/suite]
 *
 * - Reutiliza **una sola sesión QA** (QA_USER/QA_PASS o `.env.pruebas`) con
 *   `storageState` fuera del repo (`~/.nexo-contable/storage-qa.json`).
 * - Captura escritorio 1440×900 y móvil 390×844 de `/login` (sin sesión) y de
 *   todas las rutas del shell.
 * - Vigila `pageerror`, `console.error` (ignora avisos `Base UI:`) y respuestas
 *   HTTP >= 400 (salvo el 401 intencional de `/login`).
 * - Sale con código 1 si alguna ruta registró errores.
 */

import { chmodSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { type Browser, type Page, chromium } from "@playwright/test";

import {
  autenticar,
  credencialesQa,
  rutaStorageState,
} from "../tests/e2e/helpers/auth";

const ESCRITORIO = { width: 1440, height: 900 };
const MOVIL = { width: 390, height: 844 };
const ESPERA_RED_MS = 15_000;
const ESPERA_FIJA_MS = 800;
const RUTA_PUBLICA = "/login";

const RUTAS_SESION = [
  "/dashboard",
  "/empresas",
  "/usuarios",
  "/contabilidad",
  "/finanzas",
  "/gastos",
  "/facturacion",
  "/cuentas-por-cobrar",
  "/cuentas-por-pagar",
  "/impuestos",
  "/bancos",
  "/inventario",
  "/activos-fijos",
  "/nomina",
  "/documentos",
  "/auditoria",
] as const;

const RUTAS = [RUTA_PUBLICA, ...RUTAS_SESION] as const;

type Vista = "escritorio" | "movil";

interface Args {
  base: string;
  salida: string;
}

interface TrabajoCaptura {
  base: string;
  salida: string;
  ruta: string;
  vista: Vista;
  storageState: string | undefined;
}

function log(linea: string): void {
  process.stdout.write(`${linea}\n`);
}

function parsearArgs(argv: string[]): Args {
  let base = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3020";
  let salida = join(process.cwd(), ".capturas", "suite");

  for (let i = 0; i < argv.length; i++) {
    const clave = argv[i];
    const valor = argv[i + 1];

    if (clave === "--base" && valor) {
      base = valor;
      i++;
    } else if (clave === "--salida" && valor) {
      salida = valor;
      i++;
    } else if (clave === "--ayuda" || clave === "-h") {
      log(
        "Uso: tsx scripts/captura-todas.ts [--base http://127.0.0.1:3020] [--salida .capturas/suite]",
      );
      process.exit(0);
    }
  }

  return { base: base.replace(/\/$/, ""), salida };
}

function slug(ruta: string): string {
  return ruta === "/" ? "inicio" : ruta.slice(1).replaceAll("/", "-");
}

function claveError(ruta: string, vista: Vista): string {
  return `${ruta}::${vista}`;
}

function leerEstadoValido(ruta: string): boolean {
  if (!existsSync(ruta)) return false;

  try {
    JSON.parse(readFileSync(ruta, "utf8"));
    return true;
  } catch {
    return false;
  }
}

/** Revalida o renueva la sesión QA una sola vez y devuelve el storageState. */
async function asegurarSesion(browser: Browser, base: string): Promise<string> {
  const rutaEstado = rutaStorageState();
  const hayEstado = leerEstadoValido(rutaEstado);
  const contexto = await browser.newContext({
    storageState: hayEstado ? rutaEstado : undefined,
  });

  try {
    const page = await contexto.newPage();
    await page.goto(`${base}/dashboard`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    const destino = new URL(page.url()).pathname;
    if (destino.startsWith("/definir-password")) {
      throw new Error(
        "El usuario QA aún debe definir su contraseña en el primer ingreso.",
      );
    }

    if (destino.startsWith("/login")) {
      const credenciales = credencialesQa();
      if (credenciales === null) {
        throw new Error(
          "Faltan credenciales QA: exporta QA_USER/QA_PASS o crea .env.pruebas.",
        );
      }

      await autenticar(page, credenciales);
      await contexto.storageState({ path: rutaEstado });
      chmodSync(rutaEstado, 0o600);
      log("Sesión QA renovada y guardada fuera del repo.");
    } else if (!hayEstado) {
      await contexto.storageState({ path: rutaEstado });
      chmodSync(rutaEstado, 0o600);
    }
  } finally {
    await contexto.close();
  }

  return rutaEstado;
}

function vigilar(
  page: Page,
  ruta: string,
  registrar: (detalle: string) => void,
): void {
  page.on("pageerror", (error) => {
    registrar(`pageerror: ${String(error)}`);
  });

  page.on("console", (mensaje) => {
    if (mensaje.type() === "error" && !mensaje.text().startsWith("Base UI:")) {
      registrar(`console.error: ${mensaje.text()}`);
    }
  });

  page.on("response", (respuesta) => {
    const estado = respuesta.status();
    if (estado < 400) return;
    if (estado === 401 && ruta === RUTA_PUBLICA) return;
    registrar(`HTTP ${estado}: ${respuesta.url()}`);
  });
}

async function capturar(
  browser: Browser,
  trabajo: TrabajoCaptura,
  registrar: (detalle: string) => void,
): Promise<void> {
  const esMovil = trabajo.vista === "movil";
  const contexto = await browser.newContext({
    storageState: trabajo.storageState,
    viewport: esMovil ? MOVIL : ESCRITORIO,
    isMobile: esMovil,
    hasTouch: esMovil,
  });

  try {
    const page = await contexto.newPage();
    vigilar(page, trabajo.ruta, registrar);

    await page.goto(`${trabajo.base}${trabajo.ruta}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page
      .waitForLoadState("networkidle", { timeout: ESPERA_RED_MS })
      .catch(() => undefined);
    await page.waitForTimeout(ESPERA_FIJA_MS);

    const archivo = join(
      trabajo.salida,
      `${slug(trabajo.ruta)}-${trabajo.vista}.png`,
    );
    await page.screenshot({ path: archivo, fullPage: true });
    log(`✓ ${trabajo.vista.padEnd(10)} ${trabajo.ruta} → ${archivo}`);
  } finally {
    await contexto.close();
  }
}

function imprimirResumen(
  problemas: Map<string, string[]>,
  salida: string,
): number {
  const anchoRuta = Math.max(
    "Ruta".length,
    ...RUTAS.map((ruta) => ruta.length),
  );
  const fila = (ruta: string, escritorio: string, movil: string): string =>
    `${ruta.padEnd(anchoRuta)}  ${escritorio.padEnd(11)}  ${movil.padEnd(11)}`;

  const estadoVista = (ruta: string, vista: Vista): string => {
    const total = problemas.get(claveError(ruta, vista))?.length ?? 0;
    return total === 0 ? "OK" : `FALLA (${total})`;
  };

  log("");
  log("Resumen de capturas");
  log(fila("Ruta", "Escritorio", "Móvil"));
  log("-".repeat(anchoRuta + 26));

  for (const ruta of RUTAS) {
    log(
      fila(ruta, estadoVista(ruta, "escritorio"), estadoVista(ruta, "movil")),
    );
  }

  const detalles = [...problemas.values()].flat();
  const unicos = [...new Set(detalles)];

  if (unicos.length === 0) {
    log(`\nListo: capturas en ${salida}`);
    return 0;
  }

  console.error(`\nFALLÓ: ${unicos.length} error(es) de consola/red:`);
  for (const detalle of unicos.slice(0, 30)) {
    console.error(`  ${detalle}`);
  }
  return 1;
}

async function main(): Promise<void> {
  const args = parsearArgs(process.argv.slice(2));
  mkdirSync(args.salida, { recursive: true });

  const problemas = new Map<string, string[]>();
  const browser = await chromium.launch({ headless: true });

  try {
    const storageState = await asegurarSesion(browser, args.base);

    for (const ruta of RUTAS) {
      for (const vista of ["escritorio", "movil"] as const) {
        const clave = claveError(ruta, vista);
        const registrar = (detalle: string): void => {
          const actuales = problemas.get(clave) ?? [];
          actuales.push(detalle);
          problemas.set(clave, actuales);
        };

        await capturar(
          browser,
          {
            base: args.base,
            salida: args.salida,
            ruta,
            vista,
            storageState: ruta === RUTA_PUBLICA ? undefined : storageState,
          },
          registrar,
        );
      }
    }
  } finally {
    await browser.close();
  }

  process.exitCode = imprimirResumen(problemas, args.salida);
}

main().catch((error: unknown) => {
  console.error(
    `captura-todas: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
