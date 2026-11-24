import {
  type Moneda,
  ZONA_HORARIA,
  formatearFecha as formatearFechaIso,
  formatearMoneda,
  formatearRnc,
} from "@/lib/formato";

import type { EmpresaReporte, TipoColumna, ValorCelda } from "./tipos";

const FORMATO_FECHA_HORA = new Intl.DateTimeFormat("es-DO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: ZONA_HORARIA,
});

const FORMATO_PORCENTAJE = new Intl.NumberFormat("es-DO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatearFechaDate(fecha: Date): string {
  const dia = String(fecha.getUTCDate()).padStart(2, "0");
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${fecha.getUTCFullYear()}`;
}

export function formatearFecha(valor: ValorCelda | Date | undefined): string {
  if (valor == null || valor === "") return "";

  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? "" : formatearFechaDate(valor);
  }

  if (typeof valor === "number") {
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime())
      ? String(valor)
      : formatearFechaDate(fecha);
  }

  const fechaIso = formatearFechaIso(valor);
  if (fechaIso !== "") return fechaIso;

  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? valor : formatearFechaDate(fecha);
}

export function formatearFechaHora(fecha: Date): string {
  return FORMATO_FECHA_HORA.format(fecha);
}

export function formatearPorcentaje(valor: number): string {
  return `${FORMATO_PORCENTAJE.format(valor)} %`;
}

export function formatearDinero(
  valor: number | string,
  moneda: Moneda = "DOP",
): string {
  return formatearMoneda(valor, moneda);
}

function numeroCelda(valor: string | number): number | null {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : null;
  }

  const limpio = valor.trim().replace(/\s/g, "").replace(/,/g, "");
  if (limpio === "") return null;

  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : null;
}

export function valorExcel(
  valor: ValorCelda,
  tipo: TipoColumna,
): string | number | null {
  if (valor == null || valor === "") return null;

  if (tipo === "dinero" || tipo === "porcentaje") {
    return numeroCelda(valor);
  }

  if (tipo === "fecha") {
    const fecha = formatearFecha(valor);
    return fecha === "" ? null : fecha;
  }

  return valor;
}

export function textoCelda(
  valor: ValorCelda,
  tipo: TipoColumna,
  moneda: Moneda = "DOP",
): string {
  if (valor == null || valor === "") return "";

  if (tipo === "dinero") {
    const numero = numeroCelda(valor);
    return numero == null ? String(valor) : formatearDinero(numero, moneda);
  }

  if (tipo === "porcentaje") {
    const numero = numeroCelda(valor);
    return numero == null ? String(valor) : formatearPorcentaje(numero);
  }

  if (tipo === "fecha") return formatearFecha(valor);

  return String(valor);
}

export function nombreEmpresaReporte(empresa: EmpresaReporte): string {
  const nombreComercial = empresa.nombreComercial.trim();
  if (nombreComercial !== "") return nombreComercial;

  const razonSocial = empresa.razonSocial?.trim() ?? "";
  return razonSocial === "" ? "Nexo Contable" : razonSocial;
}

export function detalleEmpresaReporte(empresa: EmpresaReporte): string {
  const partes: string[] = [];
  const razonSocial = empresa.razonSocial?.trim() ?? "";

  if (razonSocial !== "") {
    partes.push(`Razón social: ${razonSocial}`);
  }

  const rnc = empresa.rnc == null ? "" : formatearRnc(empresa.rnc);
  if (rnc !== "") {
    partes.push(`RNC: ${rnc}`);
  }

  return partes.join(" · ");
}
