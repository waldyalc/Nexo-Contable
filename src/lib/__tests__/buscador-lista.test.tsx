// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BuscadorLista } from "@/components/listas/buscador-lista";

const navegacion = vi.hoisted(() => ({
  replace: vi.fn(),
  pathname: "/auditoria",
  parametros: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navegacion.replace }),
  usePathname: () => navegacion.pathname,
  useSearchParams: () => navegacion.parametros,
}));

const entornoGlobal = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
entornoGlobal.IS_REACT_ACT_ENVIRONMENT = true;

function campoBusqueda(etiqueta = "Buscar"): HTMLInputElement {
  const campo = screen.getByLabelText(etiqueta);
  if (!(campo instanceof HTMLInputElement)) {
    throw new Error("La prueba no encontró el input de búsqueda");
  }
  return campo;
}

function avanzar(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("BuscadorLista", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    navegacion.replace.mockClear();
    navegacion.pathname = "/auditoria";
    navegacion.parametros = new URLSearchParams();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("espera 350 ms, recorta el texto, conserva filtros y reinicia la página", () => {
    navegacion.parametros = new URLSearchParams("desde=2026-11-01&pagina=3");
    render(<BuscadorLista />);

    fireEvent.change(campoBusqueda(), {
      target: { value: "  factura  " },
    });

    avanzar(349);
    expect(navegacion.replace).not.toHaveBeenCalled();

    avanzar(1);
    expect(navegacion.replace).toHaveBeenCalledTimes(1);
    expect(navegacion.replace).toHaveBeenCalledWith(
      "/auditoria?desde=2026-11-01&q=factura",
      { scroll: false },
    );
  });

  it("usa un parámetro configurable y puede conservar la paginación", () => {
    navegacion.parametros = new URLSearchParams("pagina=2");
    render(
      <BuscadorLista
        parametro="buscar"
        parametroPagina={null}
        ariaLabel="Buscar auditoría"
      />,
    );

    fireEvent.change(campoBusqueda("Buscar auditoría"), {
      target: { value: "abc" },
    });
    avanzar(350);

    expect(navegacion.replace).toHaveBeenCalledWith(
      "/auditoria?pagina=2&buscar=abc",
      { scroll: false },
    );
  });

  it("al limpiar el campo elimina el parámetro de búsqueda", () => {
    navegacion.parametros = new URLSearchParams(
      "q=abc&entidad=factura&pagina=2",
    );
    render(<BuscadorLista />);

    const campo = campoBusqueda();
    expect(campo.value).toBe("abc");

    fireEvent.change(campo, { target: { value: "" } });
    avanzar(350);

    expect(navegacion.replace).toHaveBeenCalledWith(
      "/auditoria?entidad=factura",
      { scroll: false },
    );
  });

  it("refleja cambios externos de la URL en el input", () => {
    navegacion.parametros = new URLSearchParams("q=abc");
    const { rerender } = render(<BuscadorLista />);

    expect(campoBusqueda().value).toBe("abc");

    navegacion.parametros = new URLSearchParams("q=xyz");
    rerender(<BuscadorLista />);
    expect(campoBusqueda().value).toBe("xyz");

    navegacion.parametros = new URLSearchParams();
    rerender(<BuscadorLista />);
    expect(campoBusqueda().value).toBe("");
  });

  it("enviar el formulario actualiza la URL sin esperar el debounce", () => {
    const { container } = render(<BuscadorLista />);
    const formulario = container.querySelector("form");
    if (!(formulario instanceof HTMLFormElement)) {
      throw new Error("La prueba no renderizó el formulario");
    }

    fireEvent.change(campoBusqueda(), { target: { value: "abc" } });
    fireEvent.submit(formulario);

    expect(navegacion.replace).toHaveBeenCalledWith("/auditoria?q=abc", {
      scroll: false,
    });
  });
});
