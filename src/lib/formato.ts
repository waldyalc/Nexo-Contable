import { format } from "date-fns";
import { es } from "date-fns/locale";

/** Zona horaria contable oficial de Nexo Contable. */
export const ZONA_HORARIA = "America/Santo_Domingo";

export type Moneda = "DOP" | "USD";

const SIMBOLO_MONEDA: Record<Moneda, string> = {
  DOP: "RD$",
  USD: "US$",
};

const formatoMoneda = new Intl.NumberFormat("es-DO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Convierte un valor numérico o texto (incluye montos con separadores de miles)
 * en número. Cualquier valor no finito se trata como 0.
 */
export function aNumero(valor: number | string): number {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : 0;
  }

  const limpio = valor.trim().replace(/\s/g, "").replace(/,/g, "");
  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : 0;
}

/**
 * Formatea un monto financiero con separadores `es-DO` y dos decimales.
 * El signo negativo se coloca antes del símbolo: `-RD$ 1,250.00`.
 */
export function formatearMoneda(
  monto: number | string,
  moneda: Moneda = "DOP",
): string {
  const numero = aNumero(monto);
  const signo = numero < 0 ? "-" : "";
  return `${signo}${SIMBOLO_MONEDA[moneda]} ${formatoMoneda.format(Math.abs(numero))}`;
}

/**
 * Formatea una cantidad de inventario o unidades. Por defecto usa 2 decimales
 * y admite hasta 4 para cantidades con precisión `NUMERIC(18,4)`.
 */
export function formatearCantidad(
  cantidad: number | string,
  decimales = 2,
): string {
  const maximo = Math.min(Math.max(Math.trunc(decimales), 0), 4);
  const formateador = new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: maximo,
    maximumFractionDigits: maximo,
  });
  return formateador.format(aNumero(cantidad));
}

/**
 * Convierte una fecha ISO (`yyyy-MM-dd` o `yyyy-MM-ddTHH:mm:ss`) a `dd/MM/yyyy`
 * sin desfase de zona horaria: nunca construye un `Date` a partir del texto.
 */
export function formatearFecha(fechaIso: string): string {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaIso.trim());
  if (!coincidencia) return "";

  const [, anio, mes, dia] = coincidencia;
  if (!anio || !mes || !dia) return "";
  return `${dia}/${mes}/${anio}`;
}

/** Convierte `yyyy-MM` a un periodo legible: `noviembre de 2026`. */
export function formatearPeriodoMes(periodo: string): string {
  const coincidencia = /^(\d{4})-(\d{2})$/.exec(periodo.trim());
  if (!coincidencia) return "";

  const [, anio, mes] = coincidencia;
  if (!anio || !mes) return "";

  const numeroMes = Number(mes);
  if (numeroMes < 1 || numeroMes > 12) return "";

  return format(new Date(Number(anio), numeroMes - 1, 1), "MMMM 'de' yyyy", {
    locale: es,
  });
}

function partesEnSantoDomingo(fecha: Date): {
  anio: string;
  mes: string;
  dia: string;
} {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fecha);

  const buscar = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";

  return {
    anio: buscar("year"),
    mes: buscar("month"),
    dia: buscar("day"),
  };
}

/** Fecha de hoy (`yyyy-MM-dd`) en `America/Santo_Domingo`. */
export function hoySantoDomingo(fecha: Date = new Date()): string {
  const { anio, mes, dia } = partesEnSantoDomingo(fecha);
  return `${anio}-${mes}-${dia}`;
}

/** Periodo contable actual (`yyyy-MM`) en `America/Santo_Domingo`. */
export function periodoActualSantoDomingo(fecha: Date = new Date()): string {
  const { anio, mes } = partesEnSantoDomingo(fecha);
  return `${anio}-${mes}`;
}

/** Limpia un RNC/cédula: elimina guiones, espacios y cualquier carácter no numérico. */
export function normalizarRnc(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * Formatea un RNC dominicano de 9 dígitos (`000-00000-0`) o una cédula de
 * 11 dígitos (`000-0000000-0`). Si la longitud no coincide, devuelve los dígitos.
 */
export function formatearRnc(valor: string): string {
  const digitos = normalizarRnc(valor);

  if (digitos.length === 9) {
    return `${digitos.slice(0, 3)}-${digitos.slice(3, 8)}-${digitos.slice(8)}`;
  }

  if (digitos.length === 11) {
    return `${digitos.slice(0, 3)}-${digitos.slice(3, 10)}-${digitos.slice(10)}`;
  }

  return digitos;
}
