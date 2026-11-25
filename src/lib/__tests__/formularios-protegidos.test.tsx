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

import { DialogoAsientoManual } from "@/components/contabilidad/diario-asientos-tab";
import { DocumentoFormDialog } from "@/components/gastos/documento-form-dialog";
import {
  DialogoAnular,
  DialogoRegistrarPago,
  formularioTieneCambios,
} from "@/components/operaciones/dialogos-cartera";
import { TercerosSheet } from "@/components/terceros/terceros-sheet";
import type { ResultadoOperacion } from "@/lib/operaciones/tipos";

const acciones = vi.hoisted(() => ({
  anularDocumento: vi.fn(),
  anularPago: vi.fn(),
  contabilizarAsiento: vi.fn(),
  crearAsiento: vi.fn(),
  emitirCompra: vi.fn(),
  emitirVenta: vi.fn(),
  guardarTercero: vi.fn(),
  guardarBorrador: vi.fn(),
  refrescar: vi.fn(),
  registrarPago: vi.fn(),
  revertirAsiento: vi.fn(),
  toggleTercero: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: acciones.refrescar }),
}));

vi.mock("@/app/(app)/contabilidad/actions", () => ({
  contabilizarAsientoAction: acciones.contabilizarAsiento,
  crearAsientoManualAction: acciones.crearAsiento,
  revertirAsientoAction: acciones.revertirAsiento,
}));

vi.mock("@/app/(app)/gastos/terceros-actions", () => ({
  guardarTerceroAction: acciones.guardarTercero,
  toggleTerceroActivoAction: acciones.toggleTercero,
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

vi.mock("@/lib/operaciones/documentos-borrador-actions", () => ({
  guardarDocumentoBorradorAction: acciones.guardarBorrador,
  contabilizarDocumentoBorradorAction: vi.fn(),
  asignarNcfDocumentoBorradorAction: vi.fn(),
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

const CUENTAS_CONTABLES = [
  {
    id: "bb2ee5cf-9e64-4c35-a2bb-cf16c6848be5",
    codigo: "1101",
    nombre: "Caja general",
    padreId: null,
    clasificacion: "asset",
    naturaleza: "debit",
    nivel: 1,
    esAgrupacion: false,
    activa: true,
    esEquivalenteEfectivo: true,
    categoriaFlujoEfectivo: "operating",
  },
  {
    id: "f7060e15-c9f7-46b6-9e2d-1b593d3093e3",
    codigo: "4101",
    nombre: "Ingresos por servicios",
    padreId: null,
    clasificacion: "income",
    naturaleza: "credit",
    nivel: 1,
    esAgrupacion: false,
    activa: true,
    esEquivalenteEfectivo: false,
    categoriaFlujoEfectivo: "",
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
      metodosPago={METODOS}
    />,
  );
  return { onOpenChange };
}

function renderizarAsiento(onOpenChange = vi.fn()) {
  render(
    <DialogoAsientoManual
      abierto
      onOpenChange={onOpenChange}
      cuentas={CUENTAS_CONTABLES}
    />,
  );
  return { onOpenChange };
}

function renderizarTerceros(onOpenChange = vi.fn()) {
  render(
    <TercerosSheet
      abierto
      onOpenChange={onOpenChange}
      empresaId="44d26251-f326-45c1-9136-30d58691a718"
      terceros={TERCEROS}
      cuentas={CUENTAS}
      tipoInicial="supplier"
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

function campoPorIndice(etiqueta: string, indice: number): HTMLInputElement {
  const campo = screen.getAllByLabelText(etiqueta)[indice];
  if (!(campo instanceof HTMLInputElement)) {
    throw new Error(`La prueba no encontró ${etiqueta} #${indice}`);
  }
  return campo;
}

async function elegirCuentaAsiento(indice: number, etiqueta: string) {
  const campo = campoPorIndice("Cuenta contable", indice);
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
    acciones.crearAsiento.mockReset();
    acciones.guardarTercero.mockReset();
    acciones.toggleTercero.mockReset();
    acciones.guardarBorrador.mockReset();
    acciones.refrescar.mockReset();
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

  it("DocumentoFormDialog ignora guardados repetidos mientras guarda el borrador", async () => {
    const guardadoPendiente: {
      resolver:
        | ((resultado: ResultadoOperacion<{ id: string }>) => void)
        | null;
    } = { resolver: null };
    acciones.guardarBorrador.mockImplementation(
      () =>
        new Promise<ResultadoOperacion<{ id: string }>>((resolver) => {
          guardadoPendiente.resolver = resolver;
        }),
    );

    const protegido = renderizarDocumento();
    fireEvent.change(campoDocumento("documento-numero"), {
      target: { value: "G-2026-0001" },
    });
    await elegirEnCombobox("documento-tercero", "Proveedor de prueba");
    await elegirEnCombobox("documento-cuenta", "1101 · Caja general");
    await elegirEnCombobox(
      "documento-metodo-pago",
      "Efectivo · 1101 Caja general · pagada",
    );
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

    expect(acciones.guardarBorrador).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Guardando…" })).toHaveProperty(
      "disabled",
      true,
    );

    exigirValor(
      guardadoPendiente.resolver,
      "El guardado del documento no quedó pendiente",
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

  it("DialogoAsientoManual cierra limpio y confirma cambios antes de descartarlos", async () => {
    const limpio = renderizarAsiento();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(limpio.onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("¿Descartar cambios?")).toBeNull();

    cleanup();

    const sucio = renderizarAsiento();
    fireEvent.change(campoDocumento("asiento-referencia"), {
      target: { value: "AJ-2026-001" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(await screen.findByText("¿Descartar cambios?")).toBeTruthy();
    expect(sucio.onOpenChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Seguir editando" }));
    await waitFor(() =>
      expect(screen.queryByText("¿Descartar cambios?")).toBeNull(),
    );
    expect(campoDocumento("asiento-referencia").value).toBe("AJ-2026-001");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(await screen.findByText("¿Descartar cambios?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(sucio.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("DialogoAsientoManual ignora contabilizaciones repetidas en curso", async () => {
    const asientoPendiente: {
      resolver: ((resultado: ResultadoOperacion) => void) | null;
    } = { resolver: null };
    acciones.crearAsiento.mockImplementation(
      () =>
        new Promise<ResultadoOperacion>((resolver) => {
          asientoPendiente.resolver = resolver;
        }),
    );

    const protegido = renderizarAsiento();
    fireEvent.change(campoDocumento("asiento-descripcion"), {
      target: { value: "Ajuste de prueba" },
    });
    await elegirCuentaAsiento(0, "1101 · Caja general");
    await elegirCuentaAsiento(1, "4101 · Ingresos por servicios");
    fireEvent.change(campoPorIndice("Débito", 0), {
      target: { value: "100.00" },
    });
    fireEvent.change(campoPorIndice("Crédito", 1), {
      target: { value: "100.00" },
    });

    const formulario = campoDocumento("asiento-descripcion").form;
    if (!(formulario instanceof HTMLFormElement)) {
      throw new Error("La prueba no encontró el formulario del asiento");
    }

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Contabilizar" }),
      ).toHaveProperty("disabled", false),
    );

    fireEvent.submit(formulario);
    fireEvent.submit(formulario);
    fireEvent.submit(formulario);

    expect(acciones.crearAsiento).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Contabilizando…" }),
    ).toHaveProperty("disabled", true);

    exigirValor(
      asientoPendiente.resolver,
      "La creación del asiento no quedó pendiente",
    )({
      ok: true,
      mensaje: "Asiento contabilizado.",
    });

    await waitFor(() =>
      expect(protegido.onOpenChange).toHaveBeenCalledWith(false),
    );
    expect(screen.queryByText("¿Descartar cambios?")).toBeNull();
  });

  it("TercerosSheet confirma antes de cancelar un formulario con cambios", async () => {
    const protegido = renderizarTerceros();

    fireEvent.click(screen.getByRole("button", { name: "Nuevo tercero" }));
    fireEvent.change(campoDocumento("tercero-nombre"), {
      target: { value: "Proveedor digitado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(await screen.findByText("¿Descartar cambios?")).toBeTruthy();
    expect(protegido.onOpenChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Seguir editando" }));
    await waitFor(() =>
      expect(screen.queryByText("¿Descartar cambios?")).toBeNull(),
    );
    expect(campoDocumento("tercero-nombre").value).toBe("Proveedor digitado");

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(await screen.findByText("¿Descartar cambios?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));

    expect(
      await screen.findByRole("button", { name: "Nuevo tercero" }),
    ).toBeTruthy();
    expect(protegido.onOpenChange).not.toHaveBeenCalled();
  });

  it("TercerosSheet intercepta la X del panel cuando el formulario está sucio", async () => {
    const protegido = renderizarTerceros();

    fireEvent.click(screen.getByRole("button", { name: "Nuevo tercero" }));
    fireEvent.change(campoDocumento("tercero-nombre"), {
      target: { value: "Proveedor digitado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(await screen.findByText("¿Descartar cambios?")).toBeTruthy();
    expect(protegido.onOpenChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(protegido.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("TercerosSheet ignora guardados repetidos mientras la acción sigue en curso", async () => {
    const guardadoPendiente: {
      resolver:
        | ((resultado: ResultadoOperacion<{ id: string }>) => void)
        | null;
    } = { resolver: null };
    acciones.guardarTercero.mockImplementation(
      () =>
        new Promise<ResultadoOperacion<{ id: string }>>((resolver) => {
          guardadoPendiente.resolver = resolver;
        }),
    );

    renderizarTerceros();
    fireEvent.click(screen.getByRole("button", { name: "Nuevo tercero" }));
    fireEvent.change(campoDocumento("tercero-nombre"), {
      target: { value: "Proveedor digitado" },
    });

    const formulario = campoDocumento("tercero-nombre").form;
    if (!(formulario instanceof HTMLFormElement)) {
      throw new Error("La prueba no encontró el formulario del tercero");
    }

    fireEvent.submit(formulario);
    fireEvent.submit(formulario);
    fireEvent.submit(formulario);

    expect(acciones.guardarTercero).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Guardando…" })).toHaveProperty(
      "disabled",
      true,
    );

    exigirValor(
      guardadoPendiente.resolver,
      "El guardado del tercero no quedó pendiente",
    )({
      ok: true,
      mensaje: "Tercero creado.",
      datos: { id: TERCEROS[0]?.id ?? "" },
    });

    expect(
      await screen.findByRole("button", { name: "Nuevo tercero" }),
    ).toBeTruthy();
    expect(acciones.refrescar).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("¿Descartar cambios?")).toBeNull();
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

  it("DialogoAsientoManual compara contra la foto inicial, intercepta el cierre y usa un candado ref", () => {
    const contenido = leer(
      "src/components/contabilidad/diario-asientos-tab.tsx",
    );

    expect(contenido).toContain("firmaLineasAsiento");
    expect(contenido).toContain(
      "formularioTieneCambios(estadoActual, formReferencia)",
    );
    expect(contenido).toContain("detalles.cancel()");
    expect(contenido).toContain("enviandoRef.current = true");
    expect(contenido).toContain("enviandoRef.current = false");
    expect(contenido).toContain("DialogoConfirmarDescarte");
    expect(contenido).toContain("solicitarCierre(false)");
  });

  it("TercerosSheet compara contra la foto inicial, intercepta el cierre y usa un candado ref", () => {
    const contenido = leer("src/components/terceros/terceros-sheet.tsx");

    expect(contenido).toContain("formularioTieneCambios(form, formReferencia)");
    expect(contenido).toContain("detalles.cancel()");
    expect(contenido).toContain("enviandoRef.current = true");
    expect(contenido).toContain("enviandoRef.current = false");
    expect(contenido).toContain("<DialogoConfirmarDescarte");
    expect(contenido).toContain("solicitarCancelacionFormulario");
    expect(contenido).toContain('setDescartePendiente("cerrar-sheet")');
  });
});
