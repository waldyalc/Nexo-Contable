import { describe, expect, it } from "vitest";

import type { DocumentoDetalleCompleto } from "@/lib/operaciones/consultas";
import {
  documentoAPdf,
  filasImportesDocumento,
  nombreArchivoDocumentoPdf,
} from "@/lib/reportes/documento-pdf";

const DETALLE: DocumentoDetalleCompleto = {
  documento: {
    id: "doc-1",
    tipo: "sales_invoice",
    numero: "FV-2026-00001",
    ncf: "B0200000001",
    tipoNcf: "B02",
    fechaEmision: "2026-11-20",
    fechaVencimiento: "2026-12-20",
    concepto: "Servicios profesionales",
    subtotal: 1000,
    impuesto: 180,
    retenciones: 100,
    retencionIsr: 100,
    retencionItbis: 0,
    otrasRetenciones: 0,
    otrosImpuestos: 0,
    total: 1080,
    pagado: 500,
    acreditado: 80,
    saldo: 500,
    estado: "posted",
    estadoCobro: "pendiente",
    estadoEtiqueta: "pendiente",
    motivoAnulacion: "",
  },
  tercero: {
    id: "tercero-1",
    tipo: "customer",
    tipoEtiqueta: "Cliente",
    nombre: "Cliente de prueba",
    rnc: "101000001",
  },
  pagos: [
    {
      id: "pago-1",
      fechaPago: "2026-11-21",
      metodoPago: "Transferencia",
      monto: 500,
      referencia: "TRX-1",
    },
  ],
  asiento: {
    id: "asiento-1",
    numero: "JE-2026-00001",
    fecha: "2026-11-20",
    tipoOperacion: "sales_invoice",
    descripcion: "Servicios profesionales",
    referencia: "FV-2026-00001",
    estado: "posted",
    estadoEtiqueta: "Contabilizado",
    lineas: [
      {
        id: "linea-1",
        linea: 1,
        cuentaCodigo: "1201",
        cuentaNombre: "Cuentas por cobrar",
        descripcion: "Cuentas por cobrar FV-2026-00001",
        debito: 1080,
        credito: 0,
      },
      {
        id: "linea-2",
        linea: 2,
        cuentaCodigo: "4101",
        cuentaNombre: "Ventas",
        descripcion: "Servicios profesionales",
        debito: 0,
        credito: 1000,
      },
      {
        id: "linea-3",
        linea: 3,
        cuentaCodigo: "2201",
        cuentaNombre: "ITBIS por pagar",
        descripcion: "ITBIS por pagar FV-2026-00001",
        debito: 0,
        credito: 80,
      },
    ],
  },
};

describe("documento PDF", () => {
  it("genera un nombre de archivo estable y seguro", () => {
    expect(nombreArchivoDocumentoPdf(DETALLE)).toBe(
      "factura-venta-fv-2026-00001.pdf",
    );
  });

  it("resume retenciones, pagos, créditos y saldo del documento", () => {
    const filas = filasImportesDocumento(DETALLE.documento);
    const porClave = new Map(filas.map((fila) => [fila.clave, fila.monto]));

    expect(porClave.get("subtotal")).toBe(1000);
    expect(porClave.get("itbis")).toBe(180);
    expect(porClave.get("retencion-isr")).toBe(-100);
    expect(porClave.get("retencion-itbis")).toBe(0);
    expect(porClave.get("total")).toBe(1080);
    expect(porClave.get("pagos")).toBe(500);
    expect(porClave.get("notas-credito")).toBe(80);
    expect(porClave.get("saldo")).toBe(500);
  });

  it("construye el PDF del comprobante sin errores", async () => {
    const blob = await documentoAPdf(
      DETALLE,
      {
        nombreComercial: "Empresa QA",
        razonSocial: "Empresa QA SRL",
        rnc: "101000001",
        moneda: "DOP",
      },
      new Date("2026-11-25T12:00:00Z"),
    );

    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toBe("application/pdf");
  });
});
