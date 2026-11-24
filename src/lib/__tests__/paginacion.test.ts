import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(process.cwd(), "src");
const CARPETAS_VIGILADAS = [
  path.join(RAIZ, "app"),
  path.join(RAIZ, "lib", "datos"),
];

/**
 * PostgREST devuelve como máximo 1,000 filas (`max_rows`) sin avisar.
 * Toda consulta encadenada `.from(...).select(...)` debe acotar con
 * `.range(...)`, `.limit(...)`, `.single(...)`, `.maybeSingle(...)` o
 * `{ head: true }` (conteos), o paginar con `paginarConsulta`.
 */
const CONSULTA = /\.from\(\s*[^)]*\)\s*\.select\(/g;
const GUARDA = /\.range\(|\.limit\(|\.single\(|\.maybeSingle\(|head:\s*true/;

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

describe("candado: paginacion", () => {
  it("existe el helper paginarConsulta para lotes de 1,000 filas", () => {
    const helper = path.join(RAIZ, "lib", "supabase", "paginar.ts");
    expect(fs.existsSync(helper)).toBe(true);
    expect(fs.readFileSync(helper, "utf8")).toContain("paginarConsulta");
  });

  it("no deja consultas PostgREST sin rango en src/app ni src/lib/datos", () => {
    const violaciones: string[] = [];

    for (const carpeta of CARPETAS_VIGILADAS) {
      for (const file of walkTs(carpeta)) {
        const contenido = fs.readFileSync(file, "utf8");

        for (const coincidencia of contenido.matchAll(CONSULTA)) {
          const inicio = coincidencia.index ?? 0;
          const finPuntoYComa = contenido.indexOf(";", inicio);
          const cadena = contenido.slice(
            inicio,
            finPuntoYComa === -1 ? contenido.length : finPuntoYComa,
          );

          if (!GUARDA.test(cadena)) {
            const relativa = path.relative(process.cwd(), file);
            violaciones.push(
              `${relativa}: la consulta .from().select() no usa .range(), .limit(), .single(), .maybeSingle() ni head: true.`,
            );
          }
        }
      }
    }

    expect(violaciones, violaciones.join("\n")).toEqual([]);
  });
});
