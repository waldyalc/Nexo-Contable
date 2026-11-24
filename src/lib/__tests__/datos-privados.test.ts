import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/**
 * Candado crítico: este repositorio es PÚBLICO.
 * Bloquea cualquier archivo .env, .sqlite, .db o carpeta work/ rastreada por git.
 */
describe("candado: datos-privados", () => {
  it("no rastrea secretos, archivos .env ni bases SQLite en git", () => {
    const tracked = execSync("git ls-files", { encoding: "utf8" })
      .split(/\r?\n/)
      .filter(Boolean);

    const prohibidos = tracked.filter((file) => {
      if (file === ".env.example") return false;
      return (
        /(^|\/)\.env($|\.)/.test(file) ||
        /\.(sqlite|sqlite3|sqlite-wal|sqlite-shm|db|pem|key)$/i.test(file) ||
        file.startsWith("work/") ||
        file.startsWith("backups/")
      );
    });

    expect(
      prohibidos,
      `Archivos privados rastreados en repo público: ${prohibidos.join(", ")}. Remuévelos con git rm --cached.`,
    ).toEqual([]);
  });
});
