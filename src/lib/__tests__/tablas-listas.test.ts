import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(process.cwd(), "src");

function leer(relativa: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativa), "utf8");
}

function walkTs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      out.push(...walkTs(full));
      continue;
    }

    if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".test.tsx")
    ) {
      out.push(full);
    }
  }

  return out;
}

describe("candado: tablas-listas", () => {
  it("Button y BarraLista nunca parten la etiqueta de un botón", () => {
    expect(leer("src/components/ui/button.tsx")).toContain("whitespace-nowrap");
    expect(leer("src/components/listas/barra-lista.tsx")).toContain(
      "whitespace-nowrap",
    );
  });

  it("TablaLista usa encabezados de 48 px (h-12)", () => {
    expect(leer("src/components/listas/tabla-lista.tsx")).toContain("h-12");
  });

  it("no usa la API asChild de Radix: Base UI renderiza con la prop render", () => {
    const violaciones: string[] = [];

    for (const file of walkTs(RAIZ)) {
      const contenido = fs.readFileSync(file, "utf8");
      if (/\basChild\b/.test(contenido)) {
        violaciones.push(
          `${path.relative(process.cwd(), file)} usa asChild. En Base UI usa la prop render.`,
        );
      }
    }

    expect(violaciones, violaciones.join("\n")).toEqual([]);
  });
});
