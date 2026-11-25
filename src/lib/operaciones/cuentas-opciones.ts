import type { CuentaOpcion } from "./tipos";

export type OperacionDocumento = "compra" | "venta";

export type CampoCuentaDocumento =
  | "principal"
  | "control"
  | "impuesto"
  | "retencion";

export interface CuentasFiscalesDocumento {
  cuentaItbisAdelantadoId?: string | null;
  cuentaItbisPorPagarId?: string | null;
  cuentaRetencionIsrId?: string | null;
  cuentaRetencionItbisId?: string | null;
  cuentaCxcDefaultId?: string | null;
  cuentaCxpDefaultId?: string | null;
}

export interface CuentasInicialesDocumento {
  cuentaControlId: string;
  cuentaImpuestoId: string;
  cuentaRetencionId: string;
}

const CLASIFICACIONES_POR_CAMPO: Record<
  OperacionDocumento,
  Record<CampoCuentaDocumento, readonly string[]>
> = {
  compra: {
    principal: ["expense", "cost", "asset"],
    control: ["liability"],
    impuesto: ["asset"],
    retencion: ["liability"],
  },
  venta: {
    principal: ["income", "asset", "liability"],
    control: ["asset"],
    impuesto: ["liability"],
    retencion: ["liability"],
  },
};

export function cuentasParaCampoDocumento(
  cuentas: readonly CuentaOpcion[],
  operacion: OperacionDocumento,
  campo: CampoCuentaDocumento,
): CuentaOpcion[] {
  const permitidas = new Set(CLASIFICACIONES_POR_CAMPO[operacion][campo]);
  const filtradas = cuentas.filter((cuenta) =>
    permitidas.has(cuenta.clasificacion),
  );

  if (campo === "impuesto" && filtradas.length === 0) {
    return [...cuentas];
  }

  return filtradas;
}

function primeraCuentaDisponible(
  ...valores: readonly (string | null | undefined)[]
): string {
  for (const valor of valores) {
    if (valor != null && valor !== "") return valor;
  }

  return "";
}

export function resolverCuentaRetencionDocumento(
  cuentas: CuentasFiscalesDocumento,
  retencionIsr = 0,
  retencionItbis = 0,
): string {
  if (retencionItbis > 0 && retencionIsr <= 0) {
    return primeraCuentaDisponible(
      cuentas.cuentaRetencionItbisId,
      cuentas.cuentaRetencionIsrId,
    );
  }

  return primeraCuentaDisponible(
    cuentas.cuentaRetencionIsrId,
    cuentas.cuentaRetencionItbisId,
  );
}

export function resolverCuentasInicialesDocumento(
  operacion: OperacionDocumento,
  cuentas: CuentasFiscalesDocumento,
): CuentasInicialesDocumento {
  return {
    cuentaControlId:
      operacion === "venta"
        ? primeraCuentaDisponible(cuentas.cuentaCxcDefaultId)
        : primeraCuentaDisponible(cuentas.cuentaCxpDefaultId),
    cuentaImpuestoId:
      operacion === "venta"
        ? primeraCuentaDisponible(cuentas.cuentaItbisPorPagarId)
        : primeraCuentaDisponible(cuentas.cuentaItbisAdelantadoId),
    cuentaRetencionId: resolverCuentaRetencionDocumento(cuentas),
  };
}

export function rellenarCuentasPorDefectoVacias<
  T extends CuentasInicialesDocumento,
>(
  valores: T,
  operacion: OperacionDocumento,
  cuentas: CuentasFiscalesDocumento,
): T {
  const iniciales = resolverCuentasInicialesDocumento(operacion, cuentas);

  return {
    ...valores,
    cuentaControlId:
      valores.cuentaControlId === ""
        ? iniciales.cuentaControlId
        : valores.cuentaControlId,
    cuentaImpuestoId:
      valores.cuentaImpuestoId === ""
        ? iniciales.cuentaImpuestoId
        : valores.cuentaImpuestoId,
    cuentaRetencionId:
      valores.cuentaRetencionId === ""
        ? iniciales.cuentaRetencionId
        : valores.cuentaRetencionId,
  };
}
