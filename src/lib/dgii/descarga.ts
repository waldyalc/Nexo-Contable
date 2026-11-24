/** Utilidades de descarga de archivos generados en el servidor. */

export const MIME_EXCEL =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Descarga un archivo cuyo contenido llegó en base64 desde una acción de
 * servidor. No usa Blob de Node: solo corre en el cliente.
 */
export function descargarBase64(
  nombreArchivo: string,
  contenidoBase64: string,
  mime = MIME_EXCEL,
) {
  const binario = atob(contenidoBase64);
  const bytes = new Uint8Array(binario.length);

  for (let indice = 0; indice < binario.length; indice += 1) {
    bytes[indice] = binario.charCodeAt(indice);
  }

  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  descargarUrl(nombreArchivo, url);
  URL.revokeObjectURL(url);
}

/** Descarga un archivo de texto plano (TXT de la DGII, plantillas CSV). */
export function descargarTexto(
  nombreArchivo: string,
  contenido: string,
  mime = "text/plain;charset=utf-8",
) {
  const blob = new Blob([contenido], { type: mime });
  const url = URL.createObjectURL(blob);
  descargarUrl(nombreArchivo, url);
  URL.revokeObjectURL(url);
}

function descargarUrl(nombreArchivo: string, url: string) {
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.rel = "noopener";
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
}
