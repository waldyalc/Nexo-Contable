import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(process.cwd(), "src");
const UI = path.join(RAIZ, "components", "ui");

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

/**
 * Candado: el `<select>` nativo rompe la paleta y los estados de foco de Nexo.
 * Usa `SelectCampo` (o `Select` de `src/components/ui`) en su lugar.
 */
describe("candado: selects-nativos", () => {
  it("prohíbe <select> nativo fuera de src/components/ui", () => {
    const violaciones: string[] = [];

    for (const file of walkTs(RAIZ)) {
      if (file.startsWith(`${UI}${path.sep}`)) continue;

      const contenido = fs.readFileSync(file, "utf8");
      if (/<select[\s>]/.test(contenido)) {
        violaciones.push(
          `${path.relative(process.cwd(), file)} usa <select>. Usa SelectCampo o Select de src/components/ui.`,
        );
      }
    }

    expect(violaciones, violaciones.join("\n")).toEqual([]);
  });
});
