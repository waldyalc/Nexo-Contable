import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright de Nexo Contable.
 *
 * - Por defecto apunta al dev server local en `127.0.0.1:3020` y lo levanta solo.
 * - Con `E2E_BASE_URL` (preview de Vercel, staging, etc.) no se levanta ningún
 *   servidor: se prueba el entorno ya desplegado.
 * - Las credenciales QA viajan por `QA_USER`/`QA_PASS` o `.env.pruebas`
 *   (nunca en el repo); ver `tests/e2e/helpers/auth.ts`.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3020";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "html" : "list",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm dev --port 3020",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
