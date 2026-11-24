/**
 * pnpm captura — capturas estándar de cualquier ruta de Nexo Contable.
 *
 * Uso:
 *   pnpm captura --ruta /login --publica
 *   pnpm captura --ruta /dashboard --base http://localhost:3000 --salida .capturas/fase1
 *
 * - Dos tomas por defecto: escritorio 1440×900 y móvil 390×844 (+ opcional --oscuro).
 * - Sesión de pruebas en storageState FUERA del repo
 *   ($NEXO_STORAGE_STATE o ~/.nexo-contable/storage-qa.json, chmod 600).
 * - Credenciales: env QA_USER/QA_PASS o .env.pruebas (nunca en git).
 * - FALLA (exit 1) ante console.error, pageerror o respuestas HTTP >= 500.
 */

import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { type Browser, type Page, chromium } from "@playwright/test";

const DESKTOP = { width: 1440, height: 900 };
const MOVIL = { width: 390, height: 844 };
const ESPERA_RED_MS = 15_000;
const ESPERA_FIJA_MS = 800;

interface Args {
  ruta: string;
  salida: string;
  base: string;
  publica: boolean;
  oscuro: boolean;
}

function log(linea: string): void {
  process.stdout.write(`${linea}\n`);
}

function parsearArgs(argv: string[]): Args {
  let ruta = "";
  let salida = "";
  let base = process.env.E2E_BASE_URL ?? "http://localhost:3000";
  let publica = false;
  let oscuro = false;

  for (let i = 0; i < argv.length; i++) {
    const clave = argv[i];
    const valor = argv[i + 1];
    if (clave === "--ruta" && valor) {
      ruta = valor;
      i++;
    } else if (clave === "--salida" && valor) {
      salida = valor;
      i++;
    } else if (clave === "--base" && valor) {
      base = valor;
      i++;
    } else if (clave === "--publica") {
      publica = true;
    } else if (clave === "--oscuro") {
      oscuro = true;
    }
  }

  if (!ruta) {
    console.error(
      "Falta --ruta. Uso: pnpm captura --ruta /dashboard [--salida .capturas] [--base http://localhost:3000] [--publica]",
    );
    process.exit(2);
  }

  return {
    ruta: ruta.startsWith("/") ? ruta : `/${ruta}`,
    salida:
      salida ||
      join(process.cwd(), ".capturas", new Date().toISOString().slice(0, 10)),
    base: base.replace(/\/$/, ""),
    publica,
    oscuro,
  };
}

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

function credenciales(): { user: string; pass: string } {
  const user = process.env.QA_USER ?? process.env.ZZTEST_USER;
  const pass = process.env.QA_PASS ?? process.env.ZZTEST_PASS;
  if (user && pass) return { user, pass };

  const candidatos = [
    join(process.cwd(), ".env.pruebas"),
    join(checkoutPrincipal(), ".env.pruebas"),
  ];
  for (const archivo of candidatos) {
    if (!existsSync(archivo)) continue;
    const env: Record<string, string> = {};
    for (const linea of readFileSync(archivo, "utf8").split("\n")) {
      const m = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(linea);
      if (m?.[1]) env[m[1]] = (m[2] ?? "").replace(/^["']|["']$/g, "");
    }
    const u = env.QA_USER ?? env.ZZTEST_USER;
    const p = env.QA_PASS ?? env.ZZTEST_PASS;
    if (u && p) return { user: u, pass: p };
  }

  console.error(
    "Sin credenciales QA: define QA_USER/QA_PASS o .env.pruebas (o usa --publica para rutas sin sesión).",
  );
  process.exit(2);
}

function rutaStorageState(): string {
  const ruta =
    process.env.NEXO_STORAGE_STATE ??
    join(homedir(), ".nexo-contable", "storage-qa.json");
  mkdirSync(dirname(ruta), { recursive: true, mode: 0o700 });
  return ruta;
}

async function renovarSesion(page: Page, base: string): Promise<void> {
  const { user, pass } = credenciales();
  await page.goto(`${base}/login`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.getByLabel(/correo/i).fill(user);
  await page.locator('input[type="password"]').first().fill(pass);
  await page
    .getByRole("button", { name: /iniciar sesión|ingresar|entrar/i })
    .click();
  await page.waitForURL(/\/(dashboard|empresas|definir-password)/, {
    timeout: 60_000,
  });
}

function vigilar(page: Page, errores: string[]): void {
  page.on("pageerror", (error) => errores.push(`pageerror: ${error}`));
  page.on("console", (mensaje) => {
    if (mensaje.type() === "error" && !mensaje.text().startsWith("Base UI:")) {
      errores.push(`console.error: ${mensaje.text()}`);
    }
  });
  page.on("response", (respuesta) => {
    if (respuesta.status() >= 500) {
      errores.push(`HTTP ${respuesta.status()}: ${respuesta.url()}`);
    }
  });
}

async function cargar(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page
    .waitForLoadState("networkidle", { timeout: ESPERA_RED_MS })
    .catch(() => undefined);
  await page.waitForTimeout(ESPERA_FIJA_MS);
}

async function tomar(
  browser: Browser,
  args: Args,
  statePath: string | undefined,
  variante: "desktop" | "oscuro" | "movil",
  errores: string[],
): Promise<string> {
  const movil = variante === "movil";
  const contexto = await browser.newContext({
    storageState: statePath,
    viewport: movil ? MOVIL : DESKTOP,
    isMobile: movil,
    hasTouch: movil,
    colorScheme: variante === "oscuro" ? "dark" : "light",
  });
  const page = await contexto.newPage();
  vigilar(page, errores);
  await cargar(page, `${args.base}${args.ruta}`);

  if (variante === "oscuro") {
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
    });
    await page.waitForTimeout(300);
  }

  const slug =
    args.ruta === "/" ? "inicio" : args.ruta.replaceAll("/", "-").slice(1);
  const archivo = join(args.salida, `${slug}-${variante}.png`);
  await page.screenshot({ path: archivo, fullPage: true });
  await contexto.close();
  return archivo;
}

async function main(): Promise<void> {
  const args = parsearArgs(process.argv.slice(2));
  mkdirSync(args.salida, { recursive: true });
  const errores: string[] = [];
  const browser = await chromium.launch({ headless: true });

  try {
    let statePath: string | undefined;

    if (!args.publica) {
      statePath = rutaStorageState();
      const hayEstado = (() => {
        if (!existsSync(statePath)) return false;
        try {
          JSON.parse(readFileSync(statePath, "utf8"));
          return true;
        } catch {
          return false;
        }
      })();

      const ctx = await browser.newContext({
        storageState: hayEstado ? statePath : undefined,
      });
      const page = await ctx.newPage();
      await cargar(page, `${args.base}${args.ruta}`);
      if (page.url().includes("/login")) {
        await renovarSesion(page, args.base);
        await ctx.storageState({ path: statePath });
        chmodSync(statePath, 0o600);
        log("Sesión QA renovada y guardada fuera del repo.");
      } else if (!hayEstado) {
        await ctx.storageState({ path: statePath });
        chmodSync(statePath, 0o600);
      }
      await ctx.close();
    }

    const variantes: Array<"desktop" | "oscuro" | "movil"> = args.oscuro
      ? ["desktop", "oscuro", "movil"]
      : ["desktop", "movil"];

    for (const variante of variantes) {
      const archivo = await tomar(browser, args, statePath, variante, errores);
      log(`✓ ${variante}: ${archivo}`);
    }
  } finally {
    await browser.close();
  }

  if (errores.length > 0) {
    console.error(`\nFALLÓ: ${errores.length} error(es) de consola/red:`);
    for (const e of [...new Set(errores)].slice(0, 30)) {
      console.error(`  ${e}`);
    }
    process.exit(1);
  }
  log(`\nListo: capturas guardadas en ${args.salida}`);
}

main().catch((error) => {
  console.error(`captura: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
