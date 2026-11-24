import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(process.cwd(), "src");
const UI = path.join(RAIZ, "components", "ui");

/**
 * Candado: los controles nativos de fecha no respetan el diseño de Nexo ni la
 * zona horaria contable. Usa `DatePicker`, `DateRangePicker` o `MonthPicker`.
 */
const PROHIBIDOS = [
  {
    nombre: '<input type="date">',
    patron: /<input\b[^>]*\btype\s*=\s*["']date["']/i,
  },
  {
    nombre: '<input type="month">',
    patron: /<input\b[^>]*\btype\s*=\s*["']month["']/i,
  },
];

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

describe("candado: fechas-nativas", () => {
  it("prohíbe <input type=date|month> fuera de src/components/ui", () => {
    const violaciones: string[] = [];

    for (const file of walkTs(RAIZ)) {
      if (file.startsWith(`${UI}${path.sep}`)) continue;

      const contenido = fs.readFileSync(file, "utf8");
      for (const { nombre, patron } of PROHIBIDOS) {
        if (patron.test(contenido)) {
          violaciones.push(
            `${path.relative(process.cwd(), file)} usa ${nombre}. Usa DatePicker, DateRangePicker o MonthPicker.`,
          );
        }
      }
    }

    expect(violaciones, violaciones.join("\n")).toEqual([]);
  });
});
