import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase", "migrations");

describe("candado: migraciones", () => {
  it("todas las migraciones usan timestamp UTC YYYYMMDDHHMMSS_nombre.sql, sin duplicados ni vacías", () => {
    if (!fs.existsSync(MIGRATIONS_DIR)) return;
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const timestamps = new Set<string>();
    for (const file of files) {
      expect(
        /^\d{14}_[a-z0-9_]+\.sql$/.test(file),
        `Nombre inválido de migración: ${file}. Usa YYYYMMDDHHMMSS_snake_case.sql`,
      ).toBe(true);

      const ts = file.slice(0, 14);
      expect(
        timestamps.has(ts),
        `Timestamp duplicado en migraciones: ${ts}`,
      ).toBe(false);
      timestamps.add(ts);

      const content = fs
        .readFileSync(path.join(MIGRATIONS_DIR, file), "utf8")
        .trim();
      expect(
        content.length,
        `La migración ${file} está vacía.`,
      ).toBeGreaterThan(0);
    }
  });
});
