import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function walkTs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      out.push(...walkTs(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("candado: rpc-sin-extraer", () => {
  it("nunca extrae supabase.rpc en una variable (rompe el binding de this)", () => {
    const files = walkTs(path.resolve(process.cwd(), "src"));
    const violaciones: string[] = [];
    const pattern = /(?:const|let|var)\s+\w+\s*=\s*\w+\.rpc\b/;

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      if (pattern.test(content)) {
        violaciones.push(path.relative(process.cwd(), file));
      }
    }

    expect(
      violaciones,
      `Llama supabase.rpc("nombre", args) inline. Violaciones: ${violaciones.join(", ")}`,
    ).toEqual([]);
  });
});
