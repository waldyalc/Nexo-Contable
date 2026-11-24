import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PAGINAS = [
  ["src/app/(app)/dashboard/page.tsx", "DashboardVista"],
  ["src/app/(app)/finanzas/page.tsx", "FinanzasVista"],
  ["src/app/(app)/impuestos/page.tsx", "ImpuestosVista"],
  ["src/app/(app)/contabilidad/page.tsx", "ContabilidadVista"],
  ["src/app/(app)/bancos/page.tsx", "BancosVista"],
  ["src/app/(app)/inventario/page.tsx", "InventarioVista"],
  ["src/app/(app)/nomina/page.tsx", "NominaVista"],
  ["src/app/(app)/activos-fijos/page.tsx", "ActivosFijosVista"],
  ["src/app/(app)/cuentas-por-cobrar/page.tsx", "CarteraVista"],
  ["src/app/(app)/cuentas-por-pagar/page.tsx", "CarteraVista"],
  ["src/app/(app)/documentos/page.tsx", "DocumentosVista"],
] as const;

function leer(relativa: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativa), "utf8");
}

describe("candado: remontaje por empresa", () => {
  it("cada vista principal de empresa usa key={empresa.id}", () => {
    const violaciones: string[] = [];

    for (const [archivo, componente] of PAGINAS) {
      const contenido = leer(archivo);
      const patron = new RegExp(`<${componente}\\s[\\s\\S]*?/>`);
      const apertura = patron.exec(contenido)?.[0] ?? "";

      if (!apertura.includes("key={empresa.id}")) {
        violaciones.push(
          `${archivo} monta ${componente} sin key={empresa.id}; al cambiar de empresa conservaría estado interno.`,
        );
      }
    }

    expect(violaciones, violaciones.join("\n")).toEqual([]);
  });

  it("las vistas con estado derivado se remontan dentro de su propio ámbito", () => {
    expect(
      leer("src/components/finanzas/finanzas-vista.tsx"),
      "FinanzasVista debe remontar su contenido al cambiar empresaId",
    ).toContain("key={props.empresaId}");
    expect(
      leer("src/components/contabilidad/mayor-balanza-tab.tsx"),
      "MayorBalanzaTab debe remontar su contenido al cambiar el catálogo de cuentas",
    ).toContain("key={ambitoCuentas}");
  });
});
