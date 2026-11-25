import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const raiz = join(__dirname, "..", "..");

describe("cambio de empresa robusto", () => {
  it("las empresas inactivas no entran al contexto ni al selector", () => {
    const sesion = readFileSync(join(raiz, "lib", "auth", "sesion.ts"), "utf8");
    expect(sesion).toContain('empresa.estado === "inactive"');
  });

  it("cambiar de empresa recarga el documento completo, no solo RSC", () => {
    const switcher = readFileSync(
      join(raiz, "components", "shell", "company-switcher.tsx"),
      "utf8",
    );
    expect(switcher).toContain("window.location.reload()");
    // un refresco parcial tras cambiar de empresa deja portales a medio
    // desmontar y la pantalla sin responder a clics
    const bloque = switcher.slice(
      switcher.indexOf("async function seleccionar"),
      switcher.indexOf("async function seleccionar") + 2000,
    );
    expect(bloque).not.toContain("router.refresh()");
  });
});
