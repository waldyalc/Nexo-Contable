import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  estadoInicialConfiguracion,
  estadoInicialMetodoPago,
  estadoInicialObligacion,
  estadoInicialPresentar,
  estadoInicialRegla,
  estadoInicialSecuencia,
} from "@/lib/operaciones/impuestos-dialogos";
import type {
  ConfiguracionFiscalListado,
  MetodoPagoOpcion,
  ObligacionFiscalListado,
  ReglaFiscalListado,
  SecuenciaNcfListado,
} from "@/lib/operaciones/tipos";

const secuenciaA: SecuenciaNcfListado = {
  id: "secuencia-a",
  tipoComprobante: "B01",
  serie: "B",
  prefijo: "B01",
  numeroInicial: 1,
  numeroFinal: 100,
  numeroActual: 20,
  fechaVencimiento: "2026-12-31",
  activo: true,
};

const secuenciaB: SecuenciaNcfListado = {
  id: "secuencia-b",
  tipoComprobante: "E32",
  serie: "E",
  prefijo: "E32",
  numeroInicial: 500,
  numeroFinal: 900,
  numeroActual: 700,
  fechaVencimiento: null,
  activo: false,
};

const reglaA: ReglaFiscalListado = {
  id: "regla-a",
  codigo: "ITBIS18",
  nombre: "ITBIS 18%",
  tipo: "itbis",
  tasaBps: 1800,
  cuentaId: "cuenta-itbis",
  activa: true,
};

const reglaB: ReglaFiscalListado = {
  id: "regla-b",
  codigo: "RETISR10",
  nombre: "Retención ISR 10%",
  tipo: "retencion_isr",
  tasaBps: 1000,
  cuentaId: null,
  activa: false,
};

const metodoA: MetodoPagoOpcion = {
  id: "metodo-a",
  nombre: "Transferencia",
  cuentaId: "cuenta-banco-a",
  dejaCxpProveedor: false,
  activo: true,
};

const metodoB: MetodoPagoOpcion = {
  id: "metodo-b",
  nombre: "Crédito proveedor",
  cuentaId: "cuenta-cxp-b",
  dejaCxpProveedor: true,
  activo: false,
};

const obligacionA: ObligacionFiscalListado = {
  id: "obligacion-a",
  codigoFormulario: "606",
  periodo: "202610",
  fechaLimite: "2026-11-20",
  estado: "pending",
  montoDeclarado: 1250.5,
  referenciaPresentacion: "ACUSE-A",
  presentadoEn: null,
};

const obligacionB: ObligacionFiscalListado = {
  id: "obligacion-b",
  codigoFormulario: "IT-1",
  periodo: "202611",
  fechaLimite: "2026-12-20",
  estado: "pending",
  montoDeclarado: 9800,
  referenciaPresentacion: "",
  presentadoEn: null,
};

const configuracionA: ConfiguracionFiscalListado = {
  tasaItbisBps: 1800,
  retencionIsrServiciosBps: 1000,
  retencionItbisServiciosBps: 3000,
  cuentaItbisAdelantadoId: "cfg-a-itbis-adelantado",
  cuentaItbisPorPagarId: "cfg-a-itbis-pagar",
  cuentaRetencionIsrId: "cfg-a-ret-isr",
  cuentaRetencionItbisId: "cfg-a-ret-itbis",
  cuentaCxcDefaultId: "cfg-a-cxc",
  cuentaCxpDefaultId: "cfg-a-cxp",
};

const configuracionB: ConfiguracionFiscalListado = {
  tasaItbisBps: 1600,
  retencionIsrServiciosBps: 500,
  retencionItbisServiciosBps: 2500,
  cuentaItbisAdelantadoId: null,
  cuentaItbisPorPagarId: null,
  cuentaRetencionIsrId: null,
  cuentaRetencionItbisId: null,
  cuentaCxcDefaultId: null,
  cuentaCxpDefaultId: null,
};

describe("estado inicial de los diálogos de impuestos", () => {
  it("reinicia la secuencia con el registro seleccionado y limpia al crear", () => {
    expect(estadoInicialSecuencia(secuenciaA)).toEqual({
      tipoComprobante: "B01",
      prefijo: "B01",
      numeroInicial: "1",
      numeroFinal: "100",
      vencimiento: "2026-12-31",
      activo: true,
    });

    expect(estadoInicialSecuencia(secuenciaB)).toEqual({
      tipoComprobante: "E32",
      prefijo: "E32",
      numeroInicial: "500",
      numeroFinal: "900",
      vencimiento: "",
      activo: false,
    });

    expect(estadoInicialSecuencia(null)).toEqual({
      tipoComprobante: "B02",
      prefijo: "B02",
      numeroInicial: "1",
      numeroFinal: "500",
      vencimiento: "",
      activo: true,
    });
  });

  it("reinicia la regla fiscal con el registro seleccionado y limpia al crear", () => {
    expect(estadoInicialRegla(reglaA)).toEqual({
      codigo: "ITBIS18",
      nombre: "ITBIS 18%",
      tipo: "itbis",
      tasa: "18.00",
      cuentaId: "cuenta-itbis",
      activa: true,
    });

    expect(estadoInicialRegla(reglaB)).toEqual({
      codigo: "RETISR10",
      nombre: "Retención ISR 10%",
      tipo: "retencion_isr",
      tasa: "10.00",
      cuentaId: "",
      activa: false,
    });

    expect(estadoInicialRegla(null)).toEqual({
      codigo: "",
      nombre: "",
      tipo: "itbis",
      tasa: "18.00",
      cuentaId: "",
      activa: true,
    });
  });

  it("reinicia el método de pago con el registro seleccionado y limpia al crear", () => {
    expect(estadoInicialMetodoPago(metodoA)).toEqual({
      nombre: "Transferencia",
      cuentaId: "cuenta-banco-a",
      dejaCxp: false,
      activo: true,
    });

    expect(estadoInicialMetodoPago(metodoB)).toEqual({
      nombre: "Crédito proveedor",
      cuentaId: "cuenta-cxp-b",
      dejaCxp: true,
      activo: false,
    });

    expect(estadoInicialMetodoPago(null)).toEqual({
      nombre: "",
      cuentaId: "",
      dejaCxp: false,
      activo: true,
    });
  });

  it("reinicia la obligación nueva con el período vigente de la vista", () => {
    expect(estadoInicialObligacion("2026-11")).toEqual({
      codigoFormulario: "606",
      periodo: "2026-11",
      fechaLimite: "",
      monto: "0",
    });

    expect(estadoInicialObligacion("2027-01")).toEqual({
      codigoFormulario: "606",
      periodo: "2027-01",
      fechaLimite: "",
      monto: "0",
    });
  });

  it("reinicia la presentación con la obligación seleccionada", () => {
    expect(estadoInicialPresentar(obligacionA)).toEqual({
      estado: "filed",
      monto: "1250.50",
      referencia: "ACUSE-A",
    });

    expect(estadoInicialPresentar(obligacionB)).toEqual({
      estado: "filed",
      monto: "9800.00",
      referencia: "",
    });

    expect(estadoInicialPresentar(null)).toEqual({
      estado: "filed",
      monto: "0",
      referencia: "",
    });
  });

  it("cambia la configuración fiscal completa al cambiar de empresa", () => {
    expect(estadoInicialConfiguracion(configuracionA)).toEqual({
      tasaItbis: "18.00",
      retencionIsr: "10.00",
      retencionItbis: "30.00",
      cuentaItbisAdelantado: "cfg-a-itbis-adelantado",
      cuentaItbisPorPagar: "cfg-a-itbis-pagar",
      cuentaRetencionIsr: "cfg-a-ret-isr",
      cuentaRetencionItbis: "cfg-a-ret-itbis",
      cuentaCxc: "cfg-a-cxc",
      cuentaCxp: "cfg-a-cxp",
    });

    expect(estadoInicialConfiguracion(configuracionB)).toEqual({
      tasaItbis: "16.00",
      retencionIsr: "5.00",
      retencionItbis: "25.00",
      cuentaItbisAdelantado: "",
      cuentaItbisPorPagar: "",
      cuentaRetencionIsr: "",
      cuentaRetencionItbis: "",
      cuentaCxc: "",
      cuentaCxp: "",
    });
  });
});

const fuenteVista = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/impuestos/impuestos-vista.tsx"),
  "utf8",
);

function inicioDeComponente(nombre: string): string {
  const inicio = fuenteVista.indexOf(`function ${nombre}(`);
  return inicio < 0 ? "" : fuenteVista.slice(inicio, inicio + 2200);
}

describe("candado: reinicio de diálogos de impuestos", () => {
  it.each([
    [
      "DialogoSecuencia",
      "setForm(estadoInicialSecuencia(secuencia));",
      "}, [abierto, secuencia]);",
    ],
    [
      "DialogoRegla",
      "setForm(estadoInicialRegla(regla));",
      "}, [abierto, regla]);",
    ],
    [
      "DialogoMetodoPago",
      "setForm(estadoInicialMetodoPago(metodo));",
      "}, [abierto, metodo]);",
    ],
    [
      "DialogoObligacion",
      "setForm(estadoInicialObligacion(periodoInicial));",
      "}, [abierto, periodoInicial]);",
    ],
    [
      "DialogoPresentar",
      "setForm(estadoInicialPresentar(obligacion));",
      "}, [abierto, obligacion]);",
    ],
  ] as const)(
    "%s reinicia su formulario al abrirse o cambiar de registro",
    (nombre, reinicio, dependencias) => {
      const seccion = inicioDeComponente(nombre);

      expect(seccion).not.toBe("");
      expect(seccion).toContain("useEffect(() => {");
      expect(seccion).toContain("if (!abierto) return;");
      expect(seccion).toContain(reinicio);
      expect(seccion).toContain("setGuardando(false);");
      expect(seccion).toContain("setError(null);");
      expect(seccion).toContain(dependencias);
    },
  );

  it("PanelConfiguracion reinicia formulario y diálogos derivados", () => {
    const seccion = inicioDeComponente("PanelConfiguracion");

    expect(seccion).not.toBe("");
    expect(seccion).toContain(
      "setForm(estadoInicialConfiguracion(configuracion));",
    );
    expect(seccion).toContain("setReglaAbierta(false);");
    expect(seccion).toContain("setReglaEdicion(null);");
    expect(seccion).toContain("setMetodoAbierto(false);");
    expect(seccion).toContain("setMetodoEdicion(null);");
    expect(seccion).toContain("}, [configuracion]);");
  });

  it("remonta los paneles al cambiar de empresa", () => {
    expect(fuenteVista.match(/key=\{empresaId\}/g)).toHaveLength(4);
  });
});
