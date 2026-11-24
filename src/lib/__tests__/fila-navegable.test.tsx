// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FilaNavegable,
  dentroDeInteractivo,
} from "@/components/listas/fila-navegable";

const navegacion = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navegacion.push }),
}));

const abrir = vi.fn();

const entornoGlobal = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
entornoGlobal.IS_REACT_ACT_ENVIRONMENT = true;

function renderFila(href: string | null | undefined, children?: ReactNode) {
  return render(
    <table>
      <tbody>
        <FilaNavegable href={href}>
          {children ?? (
            <>
              <td>#1</td>
              <td>Cliente de prueba</td>
            </>
          )}
        </FilaNavegable>
      </tbody>
    </table>,
  );
}

function obtenerFila(container: HTMLElement): HTMLTableRowElement {
  const fila = container.querySelector("tr");
  if (!(fila instanceof HTMLTableRowElement)) {
    throw new Error("La prueba no renderizó una fila de tabla");
  }
  return fila;
}

type NodoFalso = { closest: (selector: string) => NodoFalso | null };

function nodo(
  coincide: (selector: string) => boolean,
  padre?: NodoFalso,
): NodoFalso {
  const elemento: NodoFalso = {
    closest: (selector) =>
      coincide(selector) ? elemento : (padre?.closest(selector) ?? null),
  };
  return elemento;
}

const esToken = (token: string) => (selector: string) =>
  selector.split(",").some((parte) => parte.trim() === token);

describe("FilaNavegable", () => {
  beforeEach(() => {
    navegacion.push.mockClear();
    abrir.mockClear();
    Object.defineProperty(window, "open", {
      configurable: true,
      writable: true,
      value: abrir,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("marca la fila como enlace enfocable y navega con clic", () => {
    const { container } = renderFila("/gastos/abc-123");
    const fila = obtenerFila(container);

    expect(fila.getAttribute("role")).toBe("link");
    expect(fila.getAttribute("tabindex")).toBe("0");
    expect(fila.getAttribute("data-href")).toBe("/gastos/abc-123");
    expect(fila.className).toContain("cursor-pointer");

    fireEvent.click(fila);

    expect(navegacion.push).toHaveBeenCalledTimes(1);
    expect(navegacion.push).toHaveBeenCalledWith("/gastos/abc-123");
    expect(abrir).not.toHaveBeenCalled();
  });

  it("sin destino queda como una fila normal", () => {
    for (const href of [null, undefined]) {
      const { container, unmount } = renderFila(href);
      const fila = obtenerFila(container);

      expect(fila.getAttribute("role")).toBeNull();
      expect(fila.getAttribute("tabindex")).toBeNull();
      expect(fila.getAttribute("data-href")).toBeNull();

      unmount();
    }
  });

  it("no intercepta el clic de un botón interno", () => {
    let clicBoton = false;
    renderFila(
      "/gastos/abc-123",
      <>
        <td>#1</td>
        <td>
          <button
            type="button"
            onClick={() => {
              clicBoton = true;
            }}
          >
            Acción interna
          </button>
        </td>
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Acción interna" }));

    expect(clicBoton).toBe(true);
    expect(navegacion.push).not.toHaveBeenCalled();
    expect(abrir).not.toHaveBeenCalled();
  });

  it("no intercepta enlaces, inputs ni items de menú internos", () => {
    renderFila(
      "/gastos/abc-123",
      <>
        <td>
          <a
            href="/enlace-interno"
            onClick={(evento) => evento.preventDefault()}
          >
            Enlace interno
          </a>
        </td>
        <td>
          <input aria-label="Campo interno" />
        </td>
        <td>
          <div role="menuitem" tabIndex={-1}>
            Item interno
          </div>
        </td>
      </>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Enlace interno" }));
    fireEvent.click(screen.getByLabelText("Campo interno"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Item interno" }));

    expect(navegacion.push).not.toHaveBeenCalled();
    expect(abrir).not.toHaveBeenCalled();
  });

  it("Ctrl+clic y Cmd+clic abren en pestaña nueva sin navegar en la actual", () => {
    const { container } = renderFila("/gastos/abc-123");
    const fila = obtenerFila(container);

    fireEvent.click(fila, { ctrlKey: true });
    fireEvent.click(fila, { metaKey: true });

    expect(abrir).toHaveBeenCalledTimes(2);
    expect(abrir).toHaveBeenCalledWith(
      "/gastos/abc-123",
      "_blank",
      "noopener,noreferrer",
    );
    expect(navegacion.push).not.toHaveBeenCalled();
  });

  it("el clic medio abre en pestaña nueva", () => {
    const { container } = renderFila("/gastos/abc-123");
    const fila = obtenerFila(container);

    fireEvent(
      fila,
      new MouseEvent("auxclick", {
        bubbles: true,
        cancelable: true,
        button: 1,
      }),
    );

    expect(abrir).toHaveBeenCalledTimes(1);
    expect(abrir).toHaveBeenCalledWith(
      "/gastos/abc-123",
      "_blank",
      "noopener,noreferrer",
    );
    expect(navegacion.push).not.toHaveBeenCalled();
  });

  it("Enter navega cuando la fila tiene foco y Ctrl+Enter abre pestaña nueva", () => {
    const { container } = renderFila("/gastos/abc-123");
    const fila = obtenerFila(container);

    fireEvent.keyDown(fila, { key: "Enter" });
    expect(navegacion.push).toHaveBeenCalledWith("/gastos/abc-123");

    fireEvent.keyDown(fila, { key: "Enter", ctrlKey: true });
    expect(abrir).toHaveBeenCalledWith(
      "/gastos/abc-123",
      "_blank",
      "noopener,noreferrer",
    );
    expect(navegacion.push).toHaveBeenCalledTimes(1);
  });

  it("la fila role=link no se traga su propio clic en celdas vacías", () => {
    const filaEl = nodo(esToken('[role="link"]'));
    const celda = nodo(() => false, filaEl);
    const texto = nodo(() => false, celda);

    expect(dentroDeInteractivo(celda, filaEl)).toBe(false);
    expect(dentroDeInteractivo(texto, filaEl)).toBe(false);
    expect(dentroDeInteractivo(filaEl, filaEl)).toBe(false);
  });

  it("un enlace o botón anidado dentro de la fila sí gana el clic", () => {
    const filaEl = nodo(esToken('[role="link"]'));
    const link = nodo(esToken("a"), filaEl);
    const iconoSvg = nodo(() => false, link);
    const boton = nodo(esToken("button"), filaEl);

    expect(dentroDeInteractivo(link, filaEl)).toBe(true);
    expect(dentroDeInteractivo(iconoSvg, filaEl)).toBe(true);
    expect(dentroDeInteractivo(boton, filaEl)).toBe(true);
    expect(dentroDeInteractivo(null, filaEl)).toBe(false);
    expect(dentroDeInteractivo({}, filaEl)).toBe(false);
  });
});
