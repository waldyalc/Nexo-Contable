import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function leer(relativa: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativa), "utf8");
}

describe("candado: ritmo vertical del dashboard", () => {
  it("contenidoEmpresa se envuelve en un contenedor flex-col con gap (no fragmento pegado)", () => {
    const contenido = leer("src/components/dashboard/dashboard-vista.tsx");

    const apertura =
      /const contenidoEmpresa = \(\s*<div className="([^"]+)"/.exec(contenido);

    expect(
      apertura,
      "contenidoEmpresa debe abrir con un <div> contenedor; un fragmento <> deja las secciones (KPIs, gráficos, asientos) sin separación vertical en la vista de administrador.",
    ).not.toBeNull();

    const clases = apertura?.[1] ?? "";
    expect(
      clases.includes("flex-col") && /gap-\d/.test(clases),
      `el contenedor de contenidoEmpresa debe ser flex-col con gap-N (hoy: "${clases}"); sin gap las tarjetas KPI quedan pegadas a la sección de gráficos.`,
    ).toBe(true);
  });
});
