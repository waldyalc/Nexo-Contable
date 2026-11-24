import { type Page, expect, test } from "@playwright/test";

import {
  type CredencialesQa,
  autenticar,
  credencialesQa,
} from "./helpers/auth";

/** Rutas del shell autenticado que debe poder recorrer cualquier usuario. */
const RUTAS_SHELL = [
  "/dashboard",
  "/bancos",
  "/inventario",
  "/contabilidad",
  "/cuentas-por-cobrar",
  "/cuentas-por-pagar",
  "/facturacion",
  "/gastos",
  "/impuestos",
  "/activos-fijos",
  "/finanzas",
  "/nomina",
  "/documentos",
  "/empresas",
  "/usuarios",
  "/auditoria",
] as const;

const SIN_CREDENCIALES =
  "Define QA_USER/QA_PASS o .env.pruebas para probar el shell autenticado.";

function credencialesRequeridas(): CredencialesQa {
  const credenciales = credencialesQa();
  test.skip(credenciales === null, SIN_CREDENCIALES);

  if (credenciales === null) {
    throw new Error(SIN_CREDENCIALES);
  }

  return credenciales;
}

/** Acumula `pageerror`, `console.error` y respuestas HTTP >= 500. */
function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];

  page.on("pageerror", (error) => {
    errores.push(`pageerror: ${String(error)}`);
  });
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

  return errores;
}

test.describe("login público", () => {
  test("renderiza el split-screen de Nexo sin registro público", async ({
    page,
  }) => {
    await page.goto("/login");

    // Split-screen: panel editorial de marca + tarjeta de acceso.
    await expect(page.locator("aside")).toBeVisible();
    await expect(
      page.getByText("Contabilidad en línea · República Dominicana"),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "La contabilidad de tu firma, ordenada y en línea.",
      }),
    ).toBeVisible();

    // Accesos: Google + correo y contraseña.
    await expect(
      page.getByRole("button", { name: "Continuar con Google" }),
    ).toBeVisible();
    await expect(page.getByLabel(/correo/i)).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Iniciar sesión" }),
    ).toBeVisible();

    // Sin registro público: ni enlaces ni botones para crear cuenta.
    await expect(
      page.getByRole("link", {
        name: /registr|crear cuenta|crear una cuenta|sign up/i,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: /registr|crear cuenta|crear una cuenta|sign up/i,
      }),
    ).toHaveCount(0);
    await expect(page.getByText("No hay registro público.")).toBeVisible();
  });

  test("las rutas privadas sin sesión redirigen al login", async ({ page }) => {
    for (const ruta of ["/dashboard", "/empresas", "/gastos"]) {
      await page.goto(ruta);
      await expect(page, `sin sesión ${ruta} debe ir a /login`).toHaveURL(
        /\/login/,
      );
    }
  });

  test("la consulta DGII sin sesión no expone datos", async ({ request }) => {
    const respuesta = await request.get("/api/dgii/rnc?numero=101000001", {
      maxRedirects: 0,
    });
    const estado = respuesta.status();

    // El route handler responde 401; si el proxy intercepta antes, redirige a
    // `/login`. Cualquier otro resultado sí sería una fuga.
    if (estado >= 300 && estado < 400) {
      expect(respuesta.headers().location ?? "").toContain("/login");
    } else {
      expect(estado).toBe(401);
    }

    const cuerpo = await respuesta.text();
    expect(cuerpo).not.toContain('"datos"');
  });
});

test.describe("sesión QA autenticada", () => {
  test("recorre el shell completo sin errores de consola ni red", async ({
    page,
  }) => {
    const credenciales = credencialesRequeridas();
    const errores = vigilarErrores(page);

    await autenticar(page, credenciales);

    if (page.url().includes("/definir-password")) {
      test.skip(
        true,
        "El usuario QA aún debe definir su contraseña en el primer ingreso.",
      );
    }

    for (const ruta of RUTAS_SHELL) {
      await page.goto(ruta, { waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("button", { name: "Mis empresas" }),
        `${ruta} debe montar el shell autenticado`,
      ).toBeVisible({ timeout: 30_000 });

      // Las vistas de administración redirigen a `/dashboard` cuando el QA no
      // tiene el rol requerido; cualquier otro destino sí sería un fallo.
      const destino = new URL(page.url()).pathname;
      expect(
        destino === ruta ||
          destino.startsWith(`${ruta}/`) ||
          destino === "/dashboard",
        `${ruta} terminó en ${destino}`,
      ).toBeTruthy();
    }

    expect(errores).toEqual([]);
  });
});
