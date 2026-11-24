import { type Page, expect, test } from "@playwright/test";

import {
  type CredencialesQa,
  autenticar,
  credencialesQa,
} from "./helpers/auth";

/** Rutas donde la UI debe usar DatePicker/MonthPicker/SelectCampo propios. */
const RUTAS_CONTROLES = [
  "/gastos",
  "/facturacion",
  "/impuestos",
  "/contabilidad",
  "/empresas",
] as const;

/** Rutas que se revisan en móvil para descartar desbordamiento horizontal. */
const RUTAS_MOVIL = ["/dashboard", "/gastos", "/facturacion"] as const;

const SIN_CREDENCIALES =
  "Define QA_USER/QA_PASS o .env.pruebas para probar la UI autenticada.";

function credencialesRequeridas(): CredencialesQa {
  const credenciales = credencialesQa();
  test.skip(credenciales === null, SIN_CREDENCIALES);

  if (credenciales === null) {
    throw new Error(SIN_CREDENCIALES);
  }

  return credenciales;
}

/** Abre una ruta y espera a que el shell autenticado esté montado. */
async function abrirShell(page: Page, ruta: string): Promise<void> {
  await page.goto(ruta, { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: "Mis empresas" }),
    `${ruta} debe montar el shell autenticado`,
  ).toBeVisible({ timeout: 30_000 });
}

test.describe("controles de UI", () => {
  test("el popover «Mis empresas» trae buscador y gestión", async ({
    page,
  }) => {
    await autenticar(page, credencialesRequeridas());
    await abrirShell(page, "/dashboard");

    await page.getByRole("button", { name: "Mis empresas" }).click();

    const popover = page.locator('[data-slot="popover-content"]');
    await expect(popover).toBeVisible();
    await expect(
      popover.getByText("Mis empresas", { exact: true }),
    ).toBeVisible();
    await expect(popover.getByPlaceholder("Buscar...")).toBeVisible();
    await expect(
      popover.getByRole("button", { name: "Gestionar empresas" }),
    ).toBeVisible();
    await expect(
      popover.getByRole("button", { name: "Actualizar empresas" }),
    ).toBeVisible();
  });

  test("no hay fechas ni selects nativos en las vistas contables", async ({
    page,
  }) => {
    await autenticar(page, credencialesRequeridas());

    for (const ruta of RUTAS_CONTROLES) {
      await abrirShell(page, ruta);

      await expect(
        page.locator('input[type="date"]'),
        `${ruta} usa <input type="date">`,
      ).toHaveCount(0);
      await expect(
        page.locator('input[type="month"]'),
        `${ruta} usa <input type="month">`,
      ).toHaveCount(0);
      await expect(
        page.locator("select"),
        `${ruta} usa <select> nativo`,
      ).toHaveCount(0);
    }
  });

  test("Gastos y compras no ofrece «Extraer 607»", async ({ page }) => {
    await autenticar(page, credencialesRequeridas());
    await abrirShell(page, "/gastos");

    await expect(
      page.getByRole("heading", { name: "Gastos y compras", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Extraer 607")).toHaveCount(0);
  });
});

test.describe("viewport móvil", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("el contenido no desborda horizontalmente", async ({ page }) => {
    await autenticar(page, credencialesRequeridas());

    for (const ruta of RUTAS_MOVIL) {
      await abrirShell(page, ruta);
      await page.waitForTimeout(400);

      const ancho = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      expect(
        ancho,
        `${ruta} desborda en móvil (scrollWidth ${ancho}px)`,
      ).toBeLessThanOrEqual(395);
    }
  });
});
