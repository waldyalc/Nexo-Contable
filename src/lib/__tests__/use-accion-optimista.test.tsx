// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useOptimistic, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAccionOptimista } from "@/components/comunes/use-accion-optimista";

const sonner = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: sonner.error,
    success: sonner.success,
  },
}));

const entornoGlobal = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
entornoGlobal.IS_REACT_ACT_ENVIRONMENT = true;

type ResultadoPrueba =
  | { ok: true; mensaje: string }
  | { ok: false; error: string };

interface FilaPrueba {
  id: string;
  activo: boolean;
}

interface EntradaPrueba {
  id: string;
  activo: boolean;
}

type AccionPrueba = (entrada: EntradaPrueba) => Promise<ResultadoPrueba>;

function crearDiferido<T>() {
  let resolver: (valor: T) => void = () => undefined;
  const promesa = new Promise<T>((resolve) => {
    resolver = resolve;
  });

  return {
    promesa,
    resolver: (valor: T) => resolver(valor),
  };
}

function Harness({
  accion,
  mostrarExito = false,
}: {
  accion: AccionPrueba;
  mostrarExito?: boolean;
}) {
  const [filasBase, setFilasBase] = useState<FilaPrueba[]>([
    { id: "1", activo: false },
  ]);
  const [filas, aplicarOptimista] = useOptimistic(
    filasBase,
    (actuales: readonly FilaPrueba[], cambio: FilaPrueba) =>
      actuales.map((fila) => (fila.id === cambio.id ? cambio : fila)),
  );
  const accionOptimista = useAccionOptimista();
  const activo = filas.some((fila) => fila.id === "1" && fila.activo);

  return (
    <div>
      <span data-testid="estado">{activo ? "activo" : "inactivo"}</span>
      <button
        type="button"
        disabled={accionOptimista.enCurso("1")}
        onClick={() =>
          accionOptimista.ejecutar({
            clave: "1",
            entrada: { id: "1", activo: true },
            aplicarOptimista: () => aplicarOptimista({ id: "1", activo: true }),
            accion,
            mostrarExito,
            alExito: () => setFilasBase([{ id: "1", activo: true }]),
            mensajeErrorInesperado: "Error inesperado controlado.",
          })
        }
      >
        Cambiar
      </button>
    </div>
  );
}

function estado(): string {
  return screen.getByTestId("estado").textContent ?? "";
}

function boton(): HTMLButtonElement {
  const elemento = screen.getByRole("button", { name: "Cambiar" });
  if (!(elemento instanceof HTMLButtonElement)) {
    throw new Error("La prueba no encontró el botón");
  }
  return elemento;
}

describe("useAccionOptimista", () => {
  beforeEach(() => {
    sonner.error.mockClear();
    sonner.success.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("aplica el cambio al instante, bloquea el repetido y revierte con toast si falla", async () => {
    const diferido = crearDiferido<ResultadoPrueba>();
    const accion = vi.fn(() => diferido.promesa);
    render(<Harness accion={accion} />);

    fireEvent.click(boton());

    expect(estado()).toBe("activo");
    expect(boton().disabled).toBe(true);

    fireEvent.click(boton());
    expect(accion).toHaveBeenCalledTimes(1);

    await act(async () => {
      diferido.resolver({ ok: false, error: "Fallo controlado" });
      await diferido.promesa;
    });

    expect(estado()).toBe("inactivo");
    expect(sonner.error).toHaveBeenCalledWith("Fallo controlado");
    expect(boton().disabled).toBe(false);
  });

  it("consolida el estado base y muestra éxito cuando la acción termina bien", async () => {
    const accion = vi.fn(
      async (): Promise<ResultadoPrueba> => ({ ok: true, mensaje: "Hecho" }),
    );
    render(<Harness accion={accion} mostrarExito />);

    fireEvent.click(boton());
    expect(estado()).toBe("activo");

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(estado()).toBe("activo");
    expect(sonner.success).toHaveBeenCalledWith("Hecho");
    expect(boton().disabled).toBe(false);
  });

  it("revierte y muestra un mensaje claro cuando la acción lanza una excepción", async () => {
    const accion = vi.fn(async () => {
      throw new Error("red caída");
    });
    render(<Harness accion={accion} />);

    fireEvent.click(boton());
    expect(estado()).toBe("activo");

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(estado()).toBe("inactivo");
    expect(sonner.error).toHaveBeenCalledWith("Error inesperado controlado.");
    expect(boton().disabled).toBe(false);
  });
});
