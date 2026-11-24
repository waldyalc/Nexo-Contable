/**
 * Consulta pública de RNC/Cédula de la DGII.
 *
 * La DGII no expone una API pública: la única vía oficial es el formulario
 * ASP.NET de su Oficina Virtual:
 *   https://dgii.gov.do/app/WebApps/ConsultasWeb2/ConsultasWeb/consultas/rnc.aspx
 *
 * La página devuelve razón social, nombre comercial, estado, actividad y
 * administración local. No devuelve municipio, provincia ni dirección: esos
 * campos quedan en `null` hasta que la DGII los publique.
 *
 * El portal falla de forma intermitente (a veces responde «no se encuentra
 * inscrito» para un RNC que sí existe, y otras devuelve la tabla vacía con
 * «Ocurrió un error al intentar realizar la búsqueda»). Por eso el flujo es
 * defensivo:
 *  - cada intento usa una sesión nueva (GET + viewstate + cookie),
 *  - un «no encontrado» exige dos avisos explícitos seguidos,
 *  - una tabla vacía o un error del portal nunca es «no encontrado» y jamás se
 *    cachea: se informa que la DGII no devolvió los datos, sin afirmar que el
 *    número no existe.
 *
 * Para no castigar el portal: se identifica con un User-Agent propio, cachea 10
 * minutos los aciertos (2 los «no encontrado» confirmados), deduplica
 * solicitudes simultáneas del mismo número y se pausa 5 minutos si la DGII
 * responde 403.
 */

export type TipoDocumentoDgii = "rnc" | "cedula";

export interface DatosContribuyenteDgii {
  nombre: string;
  nombreComercial: string | null;
  municipioProvincia: string | null;
  direccion: string | null;
  estado: string | null;
}

export type CodigoErrorDgii =
  | "documento_invalido"
  | "no_encontrado"
  | "sin_datos"
  | "sin_respuesta"
  | "bloqueado"
  | "red";

export type ResultadoConsultaDgii =
  | { ok: true; datos: DatosContribuyenteDgii }
  | { ok: false; error: CodigoErrorDgii };

/** Mensajes para la interfaz: nunca afirman que un RNC no existe si falló el portal. */
export const MENSAJES_DGII: Record<CodigoErrorDgii, string> = {
  documento_invalido:
    "El RNC debe tener 9 dígitos y la cédula 11. Revisa el número.",
  no_encontrado: "La DGII no tiene ese RNC/Cédula inscrito como contribuyente.",
  sin_datos:
    "La DGII no devolvió datos para ese número. Intenta de nuevo en unos minutos.",
  sin_respuesta:
    "La DGII no respondió a la consulta. Intenta de nuevo en unos minutos.",
  bloqueado:
    "La DGII limitó las consultas temporalmente. Espera unos minutos antes de reintentar.",
  red: "No pudimos conectar con la DGII. Revisa tu conexión e intenta de nuevo.",
};

export type ResultadoParseoDgii =
  | { estado: "encontrado"; datos: DatosContribuyenteDgii }
  | { estado: "no_encontrado" }
  | { estado: "tabla_vacia" }
  | { estado: "portal_error"; mensaje: string }
  | { estado: "sin_respuesta" };

export const URL_CONSULTA_DGII =
  "https://dgii.gov.do/app/WebApps/ConsultasWeb2/ConsultasWeb/consultas/rnc.aspx";

/** Agente propio: identifica a Nexo Contable y evita el bloqueo por anonimato. */
export const AGENTE_DGII = "NexoContable/1.0";

export const TIEMPO_LIMITE_DGII_MS = 8000;

/** Intentos por consulta: el primero y, si el portal falla, dos más con sesión nueva. */
export const INTENTOS_DGII = 3;

const CAMPOS_OCULTOS = "ctl00$cphMain$txtRNCCedula";
const CAMPO_BOTON = "ctl00$cphMain$btnBuscarPorRNC";
const CACHE_EXITOS_MS = 10 * 60 * 1000;
const CACHE_NO_ENCONTRADO_MS = 2 * 60 * 1000;
const BLOQUEO_MS = 5 * 60 * 1000;
const MAXIMO_CACHE = 200;
const ESPERA_ENTRE_INTENTOS_MS = 250;

/** Aviso de la DGII cuando el número no está inscrito (se exige dos veces seguidas). */
const AVISO_NO_INSCRITO = "no se encuentra inscrito";
/** Aviso de la DGII cuando su propia búsqueda falló: no dice nada del número. */
const AVISO_FALLO_PORTAL = "ocurrio un error al intentar realizar la busqueda";

const LONGITUD: Record<TipoDocumentoDgii, number> = { rnc: 9, cedula: 11 };

interface EntradaCache {
  resultado: ResultadoConsultaDgii;
  expira: number;
}

type IntentoDgii =
  | { estado: "encontrado"; datos: DatosContribuyenteDgii }
  | { estado: "no_encontrado" }
  | { estado: "sin_datos" }
  | { estado: "sin_respuesta" }
  | { estado: "bloqueado" }
  | { estado: "red" };

type RespuestaHttpDgii =
  | { tipo: "ok"; html: string; cookie: string }
  | { tipo: "bloqueado" }
  | { tipo: "error" };

interface SeguimientoDgii {
  fallos: CodigoErrorDgii[];
  noEncontrados: number;
}

const cache = new Map<string, EntradaCache>();
const enCurso = new Map<string, Promise<ResultadoConsultaDgii>>();
let bloqueadoHasta = 0;

export function normalizarDocumentoDgii(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function validarDocumentoDgii(
  tipo: TipoDocumentoDgii,
  valor: string,
): { ok: true; numero: string } | { ok: false; error: "documento_invalido" } {
  const numero = normalizarDocumentoDgii(valor);
  if (numero.length !== LONGITUD[tipo]) {
    return { ok: false, error: "documento_invalido" };
  }
  return { ok: true, numero };
}

/** Deduce el tipo por longitud: 9 dígitos = RNC y 11 = cédula. */
export function tipoDocumentoPorLongitud(
  valor: string,
): TipoDocumentoDgii | null {
  const digitos = normalizarDocumentoDgii(valor);
  if (digitos.length === LONGITUD.rnc) return "rnc";
  if (digitos.length === LONGITUD.cedula) return "cedula";
  return null;
}

export interface CamposFormularioDgii {
  viewState: string;
  viewStateGenerator: string;
  eventValidation: string;
}

export function extraerCamposOcultos(
  html: string,
): CamposFormularioDgii | null {
  const viewState = valorOculto(html, "__VIEWSTATE");
  const eventValidation = valorOculto(html, "__EVENTVALIDATION");
  if (viewState === "" || eventValidation === "") return null;

  return {
    viewState,
    viewStateGenerator: valorOculto(html, "__VIEWSTATEGENERATOR"),
    eventValidation,
  };
}

export function construirFormularioDgii(
  campos: CamposFormularioDgii,
  numero: string,
): URLSearchParams {
  return new URLSearchParams({
    __EVENTTARGET: "",
    __EVENTARGUMENT: "",
    __VIEWSTATE: campos.viewState,
    __VIEWSTATEGENERATOR: campos.viewStateGenerator,
    __EVENTVALIDATION: campos.eventValidation,
    [CAMPOS_OCULTOS]: numero,
    [CAMPO_BOTON]: "BUSCAR",
  });
}

/**
 * Lee la página de resultados. Primero los datos (si hay nombre, se encontró) y
 * solo después los avisos: así un texto de «no inscrito» escondido en la página
 * nunca tapa un contribuyente que sí llegó en la tabla.
 */
export function parsearRespuestaDgii(html: string): ResultadoParseoDgii {
  const tabla = html.match(
    /<table[^>]*id="cphMain_dvDatosContribuyentes"[\s\S]*?<\/table>/i,
  )?.[0];
  const campos =
    tabla === undefined ? new Map<string, string>() : leerFilas(tabla);
  const razonSocial =
    campos.get("nombre/razon social") ?? campos.get("razon social") ?? "";
  const nombreComercial = campos.get("nombre comercial") ?? "";
  const nombre = razonSocial === "" ? nombreComercial : razonSocial;

  if (nombre !== "") {
    return {
      estado: "encontrado",
      datos: {
        nombre,
        nombreComercial: nombreComercial === "" ? null : nombreComercial,
        municipioProvincia: primerValor(campos, [
          "municipio/provincia",
          "municipio",
          "provincia",
        ]),
        direccion: primerValor(campos, ["direccion"]),
        estado: primerValor(campos, ["estado"]),
      },
    };
  }

  const aviso = leerAviso(html);
  const avisoClave = claveEtiqueta(aviso);
  if (avisoClave.includes(AVISO_NO_INSCRITO))
    return { estado: "no_encontrado" };
  if (avisoClave !== "") return { estado: "portal_error", mensaje: aviso };

  // Si la DGII mueve el aviso a otro elemento, se busca en el texto de la página.
  const paginaClave = claveEtiqueta(textoPlano(html));
  if (paginaClave.includes(AVISO_NO_INSCRITO))
    return { estado: "no_encontrado" };
  if (paginaClave.includes(AVISO_FALLO_PORTAL)) {
    return {
      estado: "portal_error",
      mensaje: "La DGII devolvió un error al intentar la búsqueda.",
    };
  }
  if (tabla === undefined) return { estado: "sin_respuesta" };
  return { estado: "tabla_vacia" };
}

/** Consulta la DGII con caché, deduplicación y reintentos defensivos. */
export async function consultarDgii(
  tipo: TipoDocumentoDgii,
  valor: string,
): Promise<ResultadoConsultaDgii> {
  const validacion = validarDocumentoDgii(tipo, valor);
  if (!validacion.ok) return validacion;

  const clave = `${tipo}:${validacion.numero}`;
  const guardado = cache.get(clave);
  if (guardado && guardado.expira > Date.now()) return guardado.resultado;

  const pendiente = enCurso.get(clave);
  if (pendiente !== undefined) return await pendiente;

  const consulta = consultarRemoto(clave, validacion.numero);
  enCurso.set(clave, consulta);
  try {
    return await consulta;
  } finally {
    enCurso.delete(clave);
  }
}

async function consultarRemoto(
  clave: string,
  numero: string,
): Promise<ResultadoConsultaDgii> {
  if (bloqueadoHasta > Date.now()) return { ok: false, error: "bloqueado" };

  // Un solo plazo para toda la operación, reintentos incluidos.
  const controlador = new AbortController();
  const temporizador = setTimeout(
    () => controlador.abort(),
    TIEMPO_LIMITE_DGII_MS,
  );
  const seguimiento: SeguimientoDgii = { fallos: [], noEncontrados: 0 };

  try {
    for (let intento = 1; intento <= INTENTOS_DGII; intento++) {
      if (intento > 1) {
        await esperar(ESPERA_ENTRE_INTENTOS_MS * (intento - 1));
        if (controlador.signal.aborted) break;
      }

      const resultado = await consultarUnaVez(numero, controlador.signal);
      const definitivo = decidirIntento(resultado, seguimiento);
      if (definitivo !== null) {
        guardarResultado(clave, definitivo);
        return definitivo;
      }
    }
  } finally {
    clearTimeout(temporizador);
  }

  // Nunca se cachea: un fallo del portal no dice nada del RNC.
  return { ok: false, error: errorFinalDgii(seguimiento.fallos) };
}

/**
 * Decide si el intento ya resuelve la consulta o si hay que repetirla con una
 * sesión nueva. Solo cuenta como «no encontrado» cuando la DGII lo dice dos
 * veces seguidas: un aviso aislado suele ser un fallo del portal.
 */
function decidirIntento(
  resultado: IntentoDgii,
  seguimiento: SeguimientoDgii,
): ResultadoConsultaDgii | null {
  if (resultado.estado === "encontrado")
    return { ok: true, datos: resultado.datos };
  if (resultado.estado === "bloqueado")
    return { ok: false, error: "bloqueado" };

  if (resultado.estado === "no_encontrado") {
    seguimiento.noEncontrados += 1;
    if (seguimiento.noEncontrados >= 2)
      return { ok: false, error: "no_encontrado" };
    return null;
  }

  seguimiento.noEncontrados = 0;
  seguimiento.fallos.push(resultado.estado);
  return null;
}

function errorFinalDgii(fallos: readonly CodigoErrorDgii[]): CodigoErrorDgii {
  if (fallos.includes("sin_datos")) return "sin_datos";
  if (fallos.includes("sin_respuesta")) return "sin_respuesta";
  if (fallos.includes("red")) return "red";
  return "sin_respuesta";
}

/** Cachea solo lo definitivo: aciertos 10 minutos y «no encontrado» confirmados 2. */
function guardarResultado(clave: string, resultado: ResultadoConsultaDgii) {
  if (resultado.ok) {
    guardarEnCache(clave, resultado, CACHE_EXITOS_MS);
    return;
  }
  if (resultado.error === "no_encontrado") {
    guardarEnCache(clave, resultado, CACHE_NO_ENCONTRADO_MS);
  }
}

/** Un intento completo con sesión nueva: GET del formulario y POST del número. */
async function consultarUnaVez(
  numero: string,
  senal: AbortSignal,
): Promise<IntentoDgii> {
  try {
    const formulario = await pedirFormulario(senal);
    if (formulario.tipo === "bloqueado") return { estado: "bloqueado" };
    if (formulario.tipo === "error") return { estado: "sin_respuesta" };

    const campos = extraerCamposOcultos(formulario.html);
    if (!campos) return { estado: "sin_respuesta" };

    const respuesta = await enviarConsulta(
      campos,
      numero,
      formulario.cookie,
      senal,
    );
    if (respuesta.tipo === "bloqueado") return { estado: "bloqueado" };
    if (respuesta.tipo === "error") return { estado: "sin_respuesta" };

    const parseo = parsearRespuestaDgii(respuesta.html);
    if (parseo.estado === "encontrado") {
      return { estado: "encontrado", datos: parseo.datos };
    }
    if (parseo.estado === "no_encontrado") return { estado: "no_encontrado" };
    if (parseo.estado === "tabla_vacia" || parseo.estado === "portal_error") {
      return { estado: "sin_datos" };
    }
    return { estado: "sin_respuesta" };
  } catch {
    if (senal.aborted) return { estado: "sin_respuesta" };
    return { estado: "red" };
  }
}

async function pedirFormulario(senal: AbortSignal): Promise<RespuestaHttpDgii> {
  const respuesta = await fetch(URL_CONSULTA_DGII, {
    cache: "no-store",
    signal: senal,
    headers: {
      accept: "text/html",
      "accept-language": "es-DO,es;q=0.9",
      "user-agent": AGENTE_DGII,
    },
  });
  if (respuesta.status === 403) {
    registrarBloqueo();
    return { tipo: "bloqueado" };
  }
  if (!respuesta.ok) return { tipo: "error" };
  return {
    tipo: "ok",
    html: await respuesta.text(),
    cookie: leerCookies(respuesta.headers),
  };
}

async function enviarConsulta(
  campos: CamposFormularioDgii,
  numero: string,
  cookie: string,
  senal: AbortSignal,
): Promise<RespuestaHttpDgii> {
  const respuesta = await fetch(URL_CONSULTA_DGII, {
    method: "POST",
    cache: "no-store",
    signal: senal,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "text/html",
      "accept-language": "es-DO,es;q=0.9",
      origin: "https://dgii.gov.do",
      referer: URL_CONSULTA_DGII,
      "user-agent": AGENTE_DGII,
      ...(cookie === "" ? {} : { cookie }),
    },
    body: construirFormularioDgii(campos, numero),
  });
  if (respuesta.status === 403) {
    registrarBloqueo();
    return { tipo: "bloqueado" };
  }
  if (!respuesta.ok) return { tipo: "error" };
  return {
    tipo: "ok",
    html: await respuesta.text(),
    cookie: leerCookies(respuesta.headers),
  };
}

function registrarBloqueo() {
  if (bloqueadoHasta > Date.now()) return;
  bloqueadoHasta = Date.now() + BLOQUEO_MS;
}

function esperar(milisegundos: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, milisegundos));
}

function leerCookies(cabeceras: Headers): string {
  const obtener = (cabeceras as Headers & { getSetCookie?: () => string[] })
    .getSetCookie;
  if (typeof obtener === "function") {
    return obtener
      .call(cabeceras)
      .map((cookie) => cookie.split(";")[0] ?? "")
      .filter((cookie) => cookie !== "")
      .join("; ");
  }
  return (cabeceras.get("set-cookie") ?? "").split(";")[0] ?? "";
}

function guardarEnCache(
  clave: string,
  resultado: ResultadoConsultaDgii,
  duracion: number,
) {
  if (cache.size >= MAXIMO_CACHE) {
    const masVieja = cache.keys().next().value;
    if (masVieja !== undefined) cache.delete(masVieja);
  }
  cache.set(clave, { resultado, expira: Date.now() + duracion });
}

function valorOculto(html: string, nombre: string): string {
  const etiquetas = html.match(/<input[^>]*>/gi) ?? [];
  for (const etiqueta of etiquetas) {
    if (!etiqueta.includes(`name="${nombre}"`)) continue;
    return etiqueta.match(/value="([^"]*)"/i)?.[1] ?? "";
  }
  return "";
}

/** Texto del aviso que la DGII muestra arriba de los resultados. */
function leerAviso(html: string): string {
  const aviso = html.match(
    /<span[^>]*id="cphMain_lblInformacion"[^>]*>([\s\S]*?)<\/span>/i,
  )?.[1];
  return aviso === undefined ? "" : textoPlano(aviso);
}

function leerFilas(tabla: string): Map<string, string> {
  const campos = new Map<string, string>();
  for (const fila of tabla.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const contenido = fila[1];
    if (!contenido) continue;
    const celdas = [
      ...contenido.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi),
    ].map((celda) => textoPlano(celda[1] ?? ""));
    const [etiqueta, valor] = celdas;
    if (!etiqueta || valor === undefined || valor === "") continue;
    campos.set(claveEtiqueta(etiqueta), valor);
  }
  return campos;
}

function primerValor(
  campos: Map<string, string>,
  llaves: string[],
): string | null {
  for (const llave of llaves) {
    const valor = campos.get(llave);
    if (valor) return valor;
  }
  return null;
}

function claveEtiqueta(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function textoPlano(fragmento: string): string {
  return decodificarEntidades(fragmento.replace(/<[^>]*>/g, " "))
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ENTIDADES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  Ntilde: "Ñ",
};

function decodificarEntidades(valor: string): string {
  return valor.replace(
    /&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g,
    (original: string, codigo: string) => {
      if (codigo.startsWith("#")) {
        const hexadecimal = codigo[1] === "x" || codigo[1] === "X";
        const numero = Number.parseInt(
          codigo.slice(hexadecimal ? 2 : 1),
          hexadecimal ? 16 : 10,
        );
        return Number.isFinite(numero) && numero > 0 && numero <= 0x10ffff
          ? String.fromCodePoint(numero)
          : original;
      }
      return ENTIDADES[codigo] ?? ENTIDADES[codigo.toLowerCase()] ?? original;
    },
  );
}
