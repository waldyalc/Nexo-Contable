// @vitest-environment jsdom

import fs from "node:fs";
import path from "node:path";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DocumentoFormDialog } from "@/components/gastos/documento-form-dialog";
import {
  DialogoAnular,
  DialogoRegistrarPago,
  formularioTieneCambios,
} from "@/components/operaciones/dialogos-cartera";
import type { ResultadoOperacion } from "@/lib/operaciones/tipos";

const acciones = vi.hoisted(() => ({
  anularDocumento: vi.fn(),
  anularPago: vi.fn(),
  emitirCompra: vi.fn(),
  emitirVenta: vi.fn(),
  registrarPago: vi.fn(),
}));

vi.mock("@/lib/operaciones/pagos-actions", () => ({
  anularDocumentoAction: acciones.anularDocumento,
  anularPagoDocumentoAction: acciones.anularPago,
  registrarPagoDocumentoAction: acciones.registrarPago,
}));

vi.mock("@/app/(app)/gastos/actions", () => ({
  emitirDocumentoCompraAction: acciones.emitirCompra,
}));

vi.mock("@/app/(app)/facturacion/actions", () => ({
  emitirDocumentoVentaAction: acciones.emitirVenta,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
  },
}));

const entornoGlobal = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
entornoGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const DOCUMENTO = {
  id: "5c4d63d7-0799-4bb7-90c5-f0516a1f3a4a",
  numero: "B0100000001",
  tercero: "Cliente de prueba",
  saldo: 100,
};

const CUENTAS = [
  {
    id: "bb2ee5cf-9e64-4c35-a2bb-cf16c6848be5",
    codigo: "1101",
    nombre: "Caja general",
    clasificacion: "asset",
  },
];

const METODOS = [
  {
    id: "b4d5d7aa-f4c5-45f6-a4c8-c1f3f431c805",
    nombre: "Efectivo",
    cuentaId: CUENTAS[0]?.id ?? "",
    dejaCxpProveedor: false,
    activo: true,
  },
];

const TERCEROS = [
  {
    id: "3f8c8544-5e5f-45fd-9b34-b9a7a6c3c7e4",
    tipo: "supplier" as const,
    nombre: "Proveedor de prueba",
    rnc: "",
    correo: "",
    telefono: "",
    direccion: "",
    activo: true,
    cuentaPorPagarId: null,
    cuentaPorCobrarId: null,
  },
];

function campoMonto(): HTMLInputElement {
  const campo = document.getElementById("pago-monto");
  if (!(campo instanceof HTMLInputElement)) {
    throw new Error("La prueba no encontró el monto del pago");
  }
  return campo;
}

function renderizarPago(onOpenChange = vi.fn(), onRegistrado = vi.fn()) {
  render(
    <DialogoRegistrarPago
      abierto
      onOpenChange={onOpenChange}
      empresaId="44d26251-f326-45c1-9136-30d58691a718"
      documento={DOCUMENTO}
      cuentas={CUENTAS}
      metodosPago={METODOS}
      etiquetaAccion="Registrar cobro"
      onRegistrado={onRegistrado}
    />,
  );
  return { onOpenChange, onRegistrado };
}

function renderizarAnulacion(onOpenChange = vi.fn(), onAnulado = vi.fn()) {
  render(
    <DialogoAnular
      abierto
      onOpenChange={onOpenChange}
      empresaId="44d26251-f326-45c1-9136-30d58691a718"
      tipo="documento"
      referenciaId={DOCUMENTO.id}
      identificador={DOCUMENTO.numero}
      onAnulado={onAnulado}
    />,
  );
  return { onOpenChange, onAnulado };
}

function renderizarDocumento(onOpenChange = vi.fn()) {
  render(
    <DocumentoFormDialog
      abierto
      onOpenChange={onOpenChange}
      empresaId="44d26251-f326-45c1-9136-30d58691a718"
      modo="compra"
      terceros={TERCEROS}
      cuentas={CUENTAS}
      secuencias={[]}
      documentosAcreditables={[]}
      tasaItbisBps={1800}
      cuentaItbisAdelantadoId={CUENTAS[0]?.id ?? null}
      cuentaRetencionIsrId={CUENTAS[0]?.id ?? null}
      cuentaCxpDefaultId={CUENTAS[0]?.id ?? null}
    />,
  );
  return { onOpenChange };
}

function campoDocumento(id: string): HTMLInputElement {
  const campo = document.getElementById(id);
  if (!(campo instanceof HTMLInputElement)) {
    throw new Error(`La prueba no encontró el campo ${id}`);
  }
  return campo;
}

function campoConcepto(): HTMLInputElement {
  return campoDocumento("documento-concepto");
}

async function elegirEnCombobox(id: string, etiqueta: string) {
  const campo = campoDocumento(id);
  fireEvent.mouseDown(campo);
  fireEvent.change(campo, { target: { value: etiqueta } });
  fireEvent.click(await screen.findByRole("option", { name: etiqueta }));
}

function campoMotivo(): HTMLTextAreaElement {
  const campo = document.getElementById("anular-motivo");
  if (!(campo instanceof HTMLTextAreaElement)) {
    throw new Error("La prueba no encontró el motivo de anulación");
  }
  return campo;
}

function leer(relativa: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativa), "utf8");
}

function exigirValor<T>(valor: T | null, mensaje: string): T {
  if (valor === null) {
    throw new Error(mensaje);
  }
  return valor;
}

async function esperarFormularioInicial() {
  await waitFor(() => expect(campoMonto().value).toBe("100.00"));
}

describe("formularioTieneCambios", () => {
  it("compara cada campo contra la foto inicial y detecta reversos al valor original", () => {
    const inicial = {
      terceroId: "tercero-1",
      concepto: "",
      subtotal: "100.00",
    };

    expect(formularioTieneCambios({ ...inicial }, inicial)).toBe(false);
    expect(
      formularioTieneCambios(
        { ...inicial, concepto: "Compra de materiales" },
        inicial,
      ),
    ).toBe(true);
    expect(
      formularioTieneCambios(
        { ...inicial, concepto: "temporal" },
        { ...inicial, concepto: "temporal" },
      ),
    ).toBe(false);
  });
});

describe("formularios operativos protegidos", () => {
  beforeEach(() => {
    acciones.registrarPago.mockReset();
    acciones.anularDocumento.mockReset();
    acciones.anularPago.mockReset();
    acciones.emitirCompra.mockReset();
    acciones.emitirVenta.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("cierra directo sin cambios, pero pide confirmación y permite seguir editando o descartar", async () => {
    const sinCambios = renderizarPago();
    await esperarFormularioInicial();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(sinCambios.onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("¿Descartar cambios?")).toBeNull();

    cleanup();

    const conCambios = renderizarPago();
    await esperarFormularioInicial();
    fireEvent.change(campoMonto(), { target: { value: "50.00" } });

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(await screen.findByText("¿Descartar cambios?")).toBeTruthy();
    expect(conCambios.onOpenChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Seguir editando" }));
    await waitFor(() =>
      expect(screen.queryByText("¿Descartar cambios?")).toBeNull(),
    );
    expect(conCambios.onOpenChange).not.toHaveBeenCalled();
    expect(campoMonto().value).toBe("50.00");

    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    if (!(overlay instanceof HTMLElement)) {
      throw new Error("La prueba no encontró el overlay del diálogo");
    }
    fireEvent.click(overlay);
    expect(await screen.findByText("¿Descartar cambios?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Seguir editando" }));
    await waitFor(() =>
      expect(screen.queryByText("¿Descartar cambios?")).toBeNull(),
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(await screen.findByText("¿Descartar cambios?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(conCambios.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("DocumentoFormDialog trata el prellenado como limpio y confirma solo cambios reales", async () => {
    const limpio = renderizarDocumento();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(limpio.onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("¿Descartar cambios?")).toBeNull();

    cleanup();

    const sucio = renderizarDocumento();
    fireEvent.change(campoConcepto(), {
      target: { value: "Compra de materiales" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(await screen.findByText("¿Descartar cambios?")).toBeTruthy();
    expect(sucio.onOpenChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(sucio.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("ignora envíos repetidos mientras la acción del pago sigue en curso", async () => {
    const pagoPendiente: {
      resolver: ((resultado: ResultadoOperacion) => void) | null;
    } = { resolver: null };
    acciones.registrarPago.mockImplementation(
      () =>
        new Promise<ResultadoOperacion>((resolver) => {
          pagoPendiente.resolver = resolver;
        }),
    );

    const protegido = renderizarPago();
    await esperarFormularioInicial();

    const formulario = campoMonto().form;
    if (!(formulario instanceof HTMLFormElement)) {
      throw new Error("La prueba no encontró el formulario del pago");
    }

    fireEvent.submit(formulario);
    fireEvent.submit(formulario);
    fireEvent.submit(formulario);

    expect(acciones.registrarPago).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Registrando…" })).toHaveProperty(
      "disabled",
      true,
    );

    exigirValor(
      pagoPendiente.resolver,
      "La acción del pago no quedó pendiente",
    )({
      ok: true,
      mensaje: "Cobro registrado.",
    });

    await waitFor(() =>
      expect(protegido.onOpenChange).toHaveBeenCalledWith(false),
    );
    expect(protegido.onRegistrado).toHaveBeenCalledTimes(1);
  });

  it("DocumentoFormDialog ignora emisiones repetidas mientras emite la compra", async () => {
    const emisionPendiente: {
      resolver:
        | ((resultado: ResultadoOperacion<{ id: string }>) => void)
        | null;
    } = { resolver: null };
    acciones.emitirCompra.mockImplementation(
      () =>
        new Promise<ResultadoOperacion<{ id: string }>>((resolver) => {
          emisionPendiente.resolver = resolver;
        }),
    );

    const protegido = renderizarDocumento();
    await elegirEnCombobox("documento-tercero", "Proveedor de prueba");
    await elegirEnCombobox("documento-cuenta", "1101 · Caja general");
    fireEvent.change(campoConcepto(), {
      target: { value: "Compra de materiales" },
    });
    fireEvent.change(campoDocumento("documento-subtotal"), {
      target: { value: "100.00" },
    });
    fireEvent.change(campoDocumento("documento-ncf"), {
      target: { value: "B0100000001" },
    });

    const formulario = campoConcepto().form;
    if (!(formulario instanceof HTMLFormElement)) {
      throw new Error("La prueba no encontró el formulario del documento");
    }

    fireEvent.submit(formulario);
    fireEvent.submit(formulario);
    fireEvent.submit(formulario);

    expect(acciones.emitirCompra).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Emitiendo…" })).toHaveProperty(
      "disabled",
      true,
    );

    exigirValor(
      emisionPendiente.resolver,
      "La emisión del documento no quedó pendiente",
    )({
      ok: true,
      mensaje: "Compra registrada.",
      datos: { id: DOCUMENTO.id },
    });

    await waitFor(() =>
      expect(protegido.onOpenChange).toHaveBeenCalledWith(false),
    );
  });

  it("también pide confirmación al cerrar una anulación con motivo escrito", async () => {
    const protegido = renderizarAnulacion();

    fireEvent.change(campoMotivo(), {
      target: { value: "Documento digitado dos veces" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(await screen.findByText("¿Descartar cambios?")).toBeTruthy();
    expect(protegido.onOpenChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(protegido.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("ignora anulaciones repetidas mientras el reverso sigue en curso", async () => {
    const anulacionPendiente: {
      resolver: ((resultado: ResultadoOperacion) => void) | null;
    } = { resolver: null };
    acciones.anularDocumento.mockImplementation(
      () =>
        new Promise<ResultadoOperacion>((resolver) => {
          anulacionPendiente.resolver = resolver;
        }),
    );

    const protegido = renderizarAnulacion();
    fireEvent.change(campoMotivo(), {
      target: { value: "Documento digitado dos veces" },
    });

    const formulario = campoMotivo().form;
    if (!(formulario instanceof HTMLFormElement)) {
      throw new Error("La prueba no encontró el formulario de anulación");
    }

    fireEvent.submit(formulario);
    fireEvent.submit(formulario);
    fireEvent.submit(formulario);

    expect(acciones.anularDocumento).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Anulando…" })).toHaveProperty(
      "disabled",
      true,
    );

    exigirValor(
      anulacionPendiente.resolver,
      "La anulación no quedó pendiente",
    )({
      ok: true,
      mensaje: "Documento anulado.",
    });

    await waitFor(() =>
      expect(protegido.onOpenChange).toHaveBeenCalledWith(false),
    );
    expect(protegido.onAnulado).toHaveBeenCalledTimes(1);
  });
});

describe("candado de cableado de formularios protegidos", () => {
  it("DocumentoFormDialog compara contra la foto inicial, intercepta el cierre y usa un candado ref", () => {
    const contenido = leer("src/components/gastos/documento-form-dialog.tsx");

    expect(contenido).toContain("formularioTieneCambios(form, formReferencia)");
    expect(contenido).toContain("detalles.cancel()");
    expect(contenido).toContain("enviandoRef.current = true");
    expect(contenido).toContain("enviandoRef.current = false");
    expect(contenido).toContain("DialogoConfirmarDescarte");
    expect(contenido).toContain("solicitarCierre(false)");
  });

  it("los dos diálogos de cartera comparten confirmación y candado estricto de envío", () => {
    const contenido = leer("src/components/operaciones/dialogos-cartera.tsx");

    expect(contenido.match(/function solicitarCierre\(/g)?.length ?? 0).toBe(2);
    expect(contenido.match(/enviandoRef\.current = true/g)?.length ?? 0).toBe(
      2,
    );
    expect(contenido.match(/<DialogoConfirmarDescarte/g)?.length ?? 0).toBe(2);
    expect(
      contenido.match(/onClick=\{\(\) => solicitarCierre\(false\)\}/g)
        ?.length ?? 0,
    ).toBe(2);
    expect(contenido).toContain("Tienes cambios sin guardar");
    expect(contenido).toContain("Seguir editando");
    expect(contenido).toContain("Descartar");
  });
});
