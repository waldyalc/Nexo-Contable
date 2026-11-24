import type {
  ConfiguracionFiscalListado,
  MetodoPagoOpcion,
  ObligacionFiscalListado,
  ReglaFiscalListado,
  SecuenciaNcfListado,
} from "./tipos";

export interface EstadoFormularioSecuencia {
  tipoComprobante: string;
  prefijo: string;
  numeroInicial: string;
  numeroFinal: string;
  vencimiento: string;
  activo: boolean;
}

export function estadoInicialSecuencia(
  secuencia: SecuenciaNcfListado | null,
): EstadoFormularioSecuencia {
  return {
    tipoComprobante: secuencia?.tipoComprobante ?? "B02",
    prefijo: secuencia?.prefijo ?? "B02",
    numeroInicial: String(secuencia?.numeroInicial ?? 1),
    numeroFinal: String(secuencia?.numeroFinal ?? 500),
    vencimiento: secuencia?.fechaVencimiento ?? "",
    activo: secuencia?.activo ?? true,
  };
}

export interface EstadoConfiguracionFiscal {
  tasaItbis: string;
  retencionIsr: string;
  retencionItbis: string;
  cuentaItbisAdelantado: string;
  cuentaItbisPorPagar: string;
  cuentaRetencionIsr: string;
  cuentaRetencionItbis: string;
  cuentaCxc: string;
  cuentaCxp: string;
}

function porcentajeDesdeBps(valor: number): string {
  return (valor / 100).toFixed(2);
}

export function estadoInicialConfiguracion(
  configuracion: ConfiguracionFiscalListado,
): EstadoConfiguracionFiscal {
  return {
    tasaItbis: porcentajeDesdeBps(configuracion.tasaItbisBps),
    retencionIsr: porcentajeDesdeBps(configuracion.retencionIsrServiciosBps),
    retencionItbis: porcentajeDesdeBps(
      configuracion.retencionItbisServiciosBps,
    ),
    cuentaItbisAdelantado: configuracion.cuentaItbisAdelantadoId ?? "",
    cuentaItbisPorPagar: configuracion.cuentaItbisPorPagarId ?? "",
    cuentaRetencionIsr: configuracion.cuentaRetencionIsrId ?? "",
    cuentaRetencionItbis: configuracion.cuentaRetencionItbisId ?? "",
    cuentaCxc: configuracion.cuentaCxcDefaultId ?? "",
    cuentaCxp: configuracion.cuentaCxpDefaultId ?? "",
  };
}

export interface EstadoFormularioRegla {
  codigo: string;
  nombre: string;
  tipo: string;
  tasa: string;
  cuentaId: string;
  activa: boolean;
}

export function estadoInicialRegla(
  regla: ReglaFiscalListado | null,
): EstadoFormularioRegla {
  return {
    codigo: regla?.codigo ?? "",
    nombre: regla?.nombre ?? "",
    tipo: regla?.tipo ?? "itbis",
    tasa: regla ? porcentajeDesdeBps(regla.tasaBps) : "18.00",
    cuentaId: regla?.cuentaId ?? "",
    activa: regla?.activa ?? true,
  };
}

export interface EstadoFormularioMetodoPago {
  nombre: string;
  cuentaId: string;
  dejaCxp: boolean;
  activo: boolean;
}

export function estadoInicialMetodoPago(
  metodo: MetodoPagoOpcion | null,
): EstadoFormularioMetodoPago {
  return {
    nombre: metodo?.nombre ?? "",
    cuentaId: metodo?.cuentaId ?? "",
    dejaCxp: metodo?.dejaCxpProveedor ?? false,
    activo: metodo?.activo ?? true,
  };
}

export interface EstadoFormularioObligacion {
  codigoFormulario: string;
  periodo: string;
  fechaLimite: string;
  monto: string;
}

export function estadoInicialObligacion(
  periodoInicial: string,
): EstadoFormularioObligacion {
  return {
    codigoFormulario: "606",
    periodo: periodoInicial,
    fechaLimite: "",
    monto: "0",
  };
}

export interface EstadoFormularioPresentar {
  estado: "filed" | "paid";
  monto: string;
  referencia: string;
}

export function estadoInicialPresentar(
  obligacion: ObligacionFiscalListado | null,
): EstadoFormularioPresentar {
  return {
    estado: "filed",
    monto: obligacion ? obligacion.montoDeclarado.toFixed(2) : "0",
    referencia: obligacion?.referenciaPresentacion ?? "",
  };
}
