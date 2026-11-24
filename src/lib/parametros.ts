/**
 * Utilidades para leer `searchParams` de las páginas y validar filtros de
 * consulta antes de enviarlos a PostgREST.
 */

/** UUID nulo: filtro que nunca coincide, usado cuando no hay elementos. */
export const UUID_NULO = "00000000-0000-0000-0000-000000000000";

const PATRON_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Primer valor de un parámetro de la URL, sin espacios sobrantes. */
export function parametroUrl(
  params: Record<string, string | string[] | undefined>,
  clave: string,
): string {
  const valor = params[clave];
  const primero = Array.isArray(valor) ? valor[0] : valor;
  return (primero ?? "").trim();
}

/** Indica si el texto es un UUID válido. */
export function esUuid(valor: string): boolean {
  return PATRON_UUID.test(valor);
}

/** Indica si el texto tiene forma de fecha `aaaa-mm-dd`. */
export function esFecha(valor: string): boolean {
  return PATRON_FECHA.test(valor);
}

/** Fecha `aaaa-mm-dd` o el valor por defecto cuando no es válida. */
export function fechaOFecha(
  valor: string,
  porDefecto: string | null,
): string | null {
  return esFecha(valor) ? valor : porDefecto;
}
