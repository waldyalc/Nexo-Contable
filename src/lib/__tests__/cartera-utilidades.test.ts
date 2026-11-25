import { describe, expect, it } from "vitest";

import {
  enriquecerPagosCartera,
  estadoDocumentoCartera,
  tercerosDeCartera,
  ultimaFacturaCartera,
} from "@/lib/cartera/utilidades";
import type {
  DocumentoListado,
  PagoListado,
  TerceroListado,
} from "@/lib/operaciones/tipos";

function documento(
  parcial: Partial<DocumentoListado> & Pick<DocumentoListado, "id" | "numero">,
): DocumentoListado {
  return {
    tipo: "purchase_invoice",
    ncf: "",
    tipoNcf: "",
    terceroId: "tercero-1",
    tercero: "Suplidor de prueba",
    fechaEmision: "2026-10-01",
    fechaVencimiento: "2026-10-31",
    concepto: "Compra de prueba",
    subtotal: 100,
    impuesto: 18,
    retenciones: 0,
    total: 118,
    pagado: 0,
    saldo: 118,
    estado: "posted",
    estadoCobro: "pendiente",
    documentoAcreditadoId: null,
    ...parcial,
  };
}

function tercero(
  parcial: Partial<TerceroListado> & Pick<TerceroListado, "id" | "tipo">,
): TerceroListado {
  return {
    nombre: "Tercero",
    rnc: "",
    correo: "",
    telefono: "",
    direccion: "",
    activo: true,
    cuentaPorPagarId: null,
    cuentaPorCobrarId: null,
    ...parcial,
  };
}

function pago(
  parcial: Partial<PagoListado> & Pick<PagoListado, "id">,
): PagoListado {
  return {
    documentoId: "doc-1",
    fechaPago: "2026-10-15",
    monto: 50,
    metodoPago: "Transferencia",
    cuentaId: "cuenta-1",
    cuenta: "1.1 · Banco",
    referencia: "",
    estado: "active",
    ...parcial,
  };
}

describe("utilidades de cartera", () => {
  it("expone el estado visible equivalente al ciclo original", () => {
    expect(
      estadoDocumentoCartera(
        documento({ id: "d1", numero: "F-1", estado: "draft" }),
      ).clave,
    ).toBe("borrador");
    expect(
      estadoDocumentoCartera(
        documento({ id: "d2", numero: "F-2", estado: "void" }),
      ).clave,
    ).toBe("anulada");
    expect(
      estadoDocumentoCartera(
        documento({ id: "d3", numero: "F-3", estadoCobro: "saldada" }),
      ).clave,
    ).toBe("saldada");
  });

  it("separa clientes y suplidores conservando los terceros compartidos", () => {
    const terceros = [
      tercero({ id: "c1", tipo: "customer" }),
      tercero({ id: "s1", tipo: "supplier" }),
      tercero({ id: "b1", tipo: "both" }),
    ];

    expect(tercerosDeCartera(terceros, "cxc").map((fila) => fila.id)).toEqual([
      "c1",
      "b1",
    ]);
    expect(tercerosDeCartera(terceros, "cxp").map((fila) => fila.id)).toEqual([
      "s1",
      "b1",
    ]);
  });

  it("enriquece pagos solo cuando el documento pertenece al ciclo", () => {
    const docs = [
      documento({ id: "doc-1", numero: "F-1", terceroId: "tercero-1" }),
    ];
    const pagos = [
      pago({ id: "p1", documentoId: "doc-1" }),
      pago({ id: "p2", documentoId: "doc-otro-ciclo" }),
    ];

    const enriquecidos = enriquecerPagosCartera(pagos, docs, {
      "tercero-1": "101000001",
    });

    expect(enriquecidos).toHaveLength(1);
    expect(enriquecidos[0]?.documento.numero).toBe("F-1");
    expect(enriquecidos[0]?.terceroRnc).toBe("101000001");
  });

  it("usa orden natural para el último número de factura", () => {
    const docs = [
      documento({ id: "f9", numero: "FC-9" }),
      documento({ id: "f10", numero: "FC-10" }),
      documento({ id: "f2", numero: "FC-2" }),
    ];

    expect(ultimaFacturaCartera(docs, "purchase_invoice")?.numero).toBe(
      "FC-10",
    );
  });
});
