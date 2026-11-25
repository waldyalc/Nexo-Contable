import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAICES = [
  path.resolve(process.cwd(), "src", "app"),
  path.resolve(process.cwd(), "src", "components"),
];

function walkTs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const archivos: string[] = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const completa = path.join(dir, entrada.name);

    if (entrada.isDirectory()) {
      if (entrada.name === "node_modules") continue;
      archivos.push(...walkTs(completa));
      continue;
    }

    if (/\.(ts|tsx)$/.test(entrada.name)) {
      archivos.push(completa);
    }
  }

  return archivos;
}

describe("candado: service-role fuera de app", () => {
  it("prohíbe SUPABASE_SERVICE_ROLE_KEY en src/app y src/components", () => {
    const violaciones: string[] = [];

    for (const raiz of RAICES) {
      for (const archivo of walkTs(raiz)) {
        const contenido = fs.readFileSync(archivo, "utf8");
        if (contenido.includes("SUPABASE_SERVICE_ROLE_KEY")) {
          violaciones.push(
            `${path.relative(process.cwd(), archivo)} menciona SUPABASE_SERVICE_ROLE_KEY. Usa una edge function o un script offline.`,
          );
        }
      }
    }

    expect(violaciones, violaciones.join("\n")).toEqual([]);
  });
});
