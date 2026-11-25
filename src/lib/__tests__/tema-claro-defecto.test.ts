import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const raiz = join(__dirname, "..", "..");

describe("tema claro por defecto y control en el menú de perfil", () => {
  it("el script anti-FOUC no sigue la preferencia del sistema: el modo por defecto es claro", () => {
    const layout = readFileSync(join(raiz, "app", "layout.tsx"), "utf8");
    expect(layout).not.toContain("prefers-color-scheme");
    expect(layout).not.toContain("matchMedia");
    expect(layout).toContain("oscuro=tema==='dark'");
  });

  it("el topbar no monta un botón alternador de tema suelto", () => {
    const topbar = readFileSync(
      join(raiz, "components", "shell", "topbar.tsx"),
      "utf8",
    );
    expect(topbar).not.toContain("AlternadorTema");
    expect(topbar).not.toContain("alternador-tema");
  });

  it("el menú de perfil ofrece las opciones Claro y Oscuro", () => {
    const menu = readFileSync(
      join(raiz, "components", "shell", "user-menu.tsx"),
      "utf8",
    );
    expect(menu).toContain("useTema");
    expect(menu).toContain("Claro");
    expect(menu).toContain("Oscuro");
    expect(menu).toContain('cambiarTema("light")');
    expect(menu).toContain('cambiarTema("dark")');
  });

  it("no existe un componente alternador-tema suelto en el shell", () => {
    expect(() =>
      readFileSync(join(raiz, "components", "shell", "alternador-tema.tsx")),
    ).toThrow();
  });
});
