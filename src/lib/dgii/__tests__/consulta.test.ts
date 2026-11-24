import { afterEach, describe, expect, test, vi } from "vitest";

import {
  type ResultadoConsultaDgii,
  type TipoDocumentoDgii,
  construirFormularioDgii,
  extraerCamposOcultos,
  normalizarDocumentoDgii,
  parsearRespuestaDgii,
  tipoDocumentoPorLongitud,
  validarDocumentoDgii,
} from "../consulta";

/** Tabla de resultados con la estructura real del portal de la DGII. */
const RESULTADO_CONTRIBUYENTE = `
<div class="table-responsive">
  <table class="table table-striped detailview" cellspacing="0" align="Center" rules="all" border="1" id="cphMain_dvDatosContribuyentes" style="border-collapse:collapse;">
    <tr><td><b>C&#233;dula/RNC</b></td><td>101-01010-1</td></tr>
    <tr><td><b>Nombre/Raz&#243;n Social</b></td><td>DISTRIBUIDORA NACIONAL SRL</td></tr>
    <tr><td><b>Nombre Comercial</b></td><td>&nbsp;</td></tr>
    <tr><td><b>R&#233;gimen de pagos</b></td><td>NORMAL</td></tr>
    <tr><td><b>Estado</b></td><td>ACTIVO</td></tr>
  </table>
</div>`;

const RESULTADO_CON_NOMBRE_COMERCIAL = `
<table class="table table-striped detailview" id="cphMain_dvDatosContribuyentes">
  <tr><td><b>C&#233;dula/RNC</b></td><td>131-48879-1</td></tr>
  <tr><td><b>Nombre/Raz&#243;n Social</b></td><td>SUMINISTROS DEL CIBAO SRL</td></tr>
  <tr><td><b>Nombre Comercial</b></td><td>SUMINISTROS CIBAO</td></tr>
  <tr><td><b>Estado</b></td><td>ACTIVO</td></tr>
</table>`;

const RESPUESTA_CON_UBICACION = `
<table id="cphMain_dvDatosContribuyentes">
  <tr><td>Nombre/Raz&#243;n Social</td><td>Ferreter&#237;a Central, SRL</td></tr>
  <tr><td>Nombre Comercial</td><td>Ferreter&#237;a Central</td></tr>
  <tr><td>Municipio/Provincia</td><td>Santiago de los Caballeros / Santiago</td></tr>
  <tr><td>Direcci&#243;n</td><td>Av. 27 de Febrero #123</td></tr>
  <tr><td>Estado</td><td>ACTIVO</td></tr>
</table>`;

/** Tabla vacía con el aviso de que la búsqueda del portal falló. */
const TABLA_VACIA_CON_ERROR = `
<h5 class="feedback">
  <span id="cphMain_lblInformacion" class="label text-info label-warning">17/11/2026 11:47 : Ocurrió un error al intentar realizar la búsqueda. Capture esta pantalla y remítala a la Oficina Virtual.</span>
</h5>
<div id="cphMain_divBusqueda" class="row consult-search__results" style="display:None;">
  <table class="table table-striped detailview" id="cphMain_dvDatosContribuyentes">

  </table>
</div>`;

const TABLA_VACIA = `
<table class="table table-striped detailview" id="cphMain_dvDatosContribuyentes">

</table>`;

const AVISO_NO_INSCRITO = `
<h5 class="feedback">
  <span id="cphMain_lblInformacion" class="label text-info label-warning">El RNC/C&#233;dula consultado no se encuentra inscrito como Contribuyente.</span>
</h5>
${TABLA_VACIA}`;

const FORMULARIO_DGII = `
<form method="post" action="./rnc.aspx" id="frmMain">
  <input type="hidden" name="__EVENTTARGET" id="__EVENTTARGET" value="" />
  <input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="vs123==" />
  <input type="hidden" name="__VIEWSTATEGENERATOR" id="__VIEWSTATEGENERATOR" value="4F4BAA71" />
  <input type="hidden" name="__EVENTVALIDATION" id="__EVENTVALIDATION" value="ev456==" />
  <input name="ctl00$cphMain$txtRNCCedula" type="text" maxlength="11" id="cphMain_txtRNCCedula" />
</form>`;

describe("validación del RNC y la cédula", () => {
  test("deja solo los dígitos", () => {
    expect(normalizarDocumentoDgii("1-31-12345-6")).toBe("131123456");
    expect(normalizarDocumentoDgii(" 001-1234567-8 ")).toBe("00112345678");
  });

  test("acepta RNC de 9 y cédula de 11, y rechaza el resto", () => {
    expect(validarDocumentoDgii("rnc", "130893489")).toEqual({
      ok: true,
      numero: "130893489",
    });
    expect(validarDocumentoDgii("cedula", "00112345678")).toEqual({
      ok: true,
      numero: "00112345678",
    });
    expect(validarDocumentoDgii("rnc", "13089348")).toEqual({
      ok: false,
      error: "documento_invalido",
    });
    expect(validarDocumentoDgii("cedula", "130893489")).toEqual({
      ok: false,
      error: "documento_invalido",
    });
    expect(validarDocumentoDgii("rnc", "")).toEqual({
      ok: false,
      error: "documento_invalido",
    });
  });

  test("un RNC con guiones se consulta sin guiones", () => {
    expect(validarDocumentoDgii("rnc", "131-48879-1")).toEqual({
      ok: true,
      numero: "131488791",
    });
  });

  test("deduce el tipo de documento por longitud", () => {
    expect(tipoDocumentoPorLongitud("101-01010-1")).toBe("rnc");
    expect(tipoDocumentoPorLongitud("001-1234567-8")).toBe("cedula");
    expect(tipoDocumentoPorLongitud("123")).toBeNull();
  });
});

describe("formulario ASP.NET de la DGII", () => {
  test("extrae los campos ocultos y la generación del viewstate", () => {
    expect(extraerCamposOcultos(FORMULARIO_DGII)).toEqual({
      viewState: "vs123==",
      viewStateGenerator: "4F4BAA71",
      eventValidation: "ev456==",
    });
  });

  test("sin event validation no se puede consultar", () => {
    expect(
      extraerCamposOcultos('<input name="__VIEWSTATE" value="solo" />'),
    ).toBeNull();
    expect(extraerCamposOcultos("<html>Acceso denegado</html>")).toBeNull();
  });

  test("arma el POST con el número y el botón de buscar", () => {
    const campos = extraerCamposOcultos(FORMULARIO_DGII);
    expect(campos).not.toBeNull();
    if (!campos) return;

    const formulario = construirFormularioDgii(campos, "130893489");
    expect(formulario.get("__VIEWSTATE")).toBe("vs123==");
    expect(formulario.get("__EVENTVALIDATION")).toBe("ev456==");
    expect(formulario.get("ctl00$cphMain$txtRNCCedula")).toBe("130893489");
    expect(formulario.get("ctl00$cphMain$btnBuscarPorRNC")).toBe("BUSCAR");
  });
});

describe("parser de la respuesta de la DGII", () => {
  test("lee la razón social y decodifica las entidades HTML", () => {
    expect(parsearRespuestaDgii(RESULTADO_CONTRIBUYENTE)).toEqual({
      estado: "encontrado",
      datos: {
        nombre: "DISTRIBUIDORA NACIONAL SRL",
        nombreComercial: null,
        municipioProvincia: null,
        direccion: null,
        estado: "ACTIVO",
      },
    });
  });

  test("lee el nombre comercial cuando la razón social viene vacía", () => {
    const resultado = parsearRespuestaDgii(
      '<table id="cphMain_dvDatosContribuyentes"><tr><td>Nombre/Raz&#243;n Social</td><td>&nbsp;</td></tr><tr><td>Nombre Comercial</td><td>Colmado La Esquina</td></tr></table>',
    );
    expect(resultado.estado).toBe("encontrado");
    if (resultado.estado !== "encontrado") return;
    expect(resultado.datos.nombre).toBe("Colmado La Esquina");
  });

  test("prioriza la razón social y lee municipio y dirección si aparecen", () => {
    const resultado = parsearRespuestaDgii(RESPUESTA_CON_UBICACION);
    expect(resultado.estado).toBe("encontrado");
    if (resultado.estado !== "encontrado") return;

    expect(resultado.datos.nombre).toBe("Ferretería Central, SRL");
    expect(resultado.datos.nombreComercial).toBe("Ferretería Central");
    expect(resultado.datos.municipioProvincia).toBe(
      "Santiago de los Caballeros / Santiago",
    );
    expect(resultado.datos.direccion).toBe("Av. 27 de Febrero #123");
  });

  test("los datos ganan aunque el aviso de no inscrito venga escondido", () => {
    const pagina = `${RESULTADO_CON_NOMBRE_COMERCIAL}<span id="cphMain_lblInformacion">El RNC consultado no se encuentra inscrito</span>`;
    expect(parsearRespuestaDgii(pagina)).toEqual({
      estado: "encontrado",
      datos: {
        nombre: "SUMINISTROS DEL CIBAO SRL",
        nombreComercial: "SUMINISTROS CIBAO",
        municipioProvincia: null,
        direccion: null,
        estado: "ACTIVO",
      },
    });
  });

  test("solo el aviso explícito de la DGII es un no encontrado", () => {
    expect(parsearRespuestaDgii(AVISO_NO_INSCRITO)).toEqual({
      estado: "no_encontrado",
    });
  });

  test("una tabla vacía no es un no encontrado", () => {
    expect(parsearRespuestaDgii(TABLA_VACIA)).toEqual({
      estado: "tabla_vacia",
    });
  });

  test("el error del portal no es un no encontrado y conserva el aviso", () => {
    const resultado = parsearRespuestaDgii(TABLA_VACIA_CON_ERROR);
    expect(resultado.estado).toBe("portal_error");
    if (resultado.estado !== "portal_error") return;
    expect(resultado.mensaje).toContain(
      "Ocurrió un error al intentar realizar la búsqueda",
    );
  });

  test("una página sin la tabla de resultados no se confunde con un contribuyente", () => {
    expect(
      parsearRespuestaDgii(
        "<html><body>Acceso Denegado - Error 403</body></html>",
      ),
    ).toEqual({ estado: "sin_respuesta" });
  });
});

/** Respuesta del portal: la página del formulario, el HTML de la consulta o un status HTTP. */
type RespuestaPortal = string | { html: string; status: number };

/**
 * Simula el portal: cada POST consume la siguiente respuesta de la lista (la
 * última se repite) y cada GET devuelve el formulario con su cookie.
 */
function simularPortal(
  respuestas: RespuestaPortal[],
  formulario: RespuestaPortal = FORMULARIO_DGII,
) {
  const llamadas: ("GET" | "POST")[] = [];
  let posts = 0;

  const falso = async (
    _entrada: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const metodo =
      (init?.method ?? "GET").toUpperCase() === "POST" ? "POST" : "GET";
    llamadas.push(metodo);

    if (metodo === "GET") {
      const { html, status } =
        typeof formulario === "string"
          ? { html: formulario, status: 200 }
          : formulario;
      return new Response(html, {
        status,
        headers: {
          "content-type": "text/html",
          "set-cookie": "sesion=dgii; path=/",
        },
      });
    }

    posts += 1;
    const elegida =
      respuestas[Math.min(posts - 1, respuestas.length - 1)] ?? "";
    const { html, status } =
      typeof elegida === "string" ? { html: elegida, status: 200 } : elegida;
    return new Response(html, {
      status,
      headers: { "content-type": "text/html" },
    });
  };

  vi.stubGlobal("fetch", falso);
  return { llamadas, posts: () => posts };
}

/** Importa el módulo con la caché y el bloqueo de 403 en blanco. */
async function moduloNuevo() {
  vi.resetModules();
  return await import("../consulta");
}

const CONTRIBUYENTE: ResultadoConsultaDgii = {
  ok: true,
  datos: {
    nombre: "DISTRIBUIDORA NACIONAL SRL",
    nombreComercial: null,
    municipioProvincia: null,
    direccion: null,
    estado: "ACTIVO",
  },
};

async function consultar(
  tipo: TipoDocumentoDgii,
  numero: string,
): Promise<ResultadoConsultaDgii> {
  const { consultarDgii } = await moduloNuevo();
  return await consultarDgii(tipo, numero);
}

describe("consulta completa a la DGII", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("una tabla vacía se reintenta con sesión nueva y devuelve el contribuyente", async () => {
    const portal = simularPortal([
      TABLA_VACIA_CON_ERROR,
      RESULTADO_CONTRIBUYENTE,
    ]);

    await expect(consultar("rnc", "101010101")).resolves.toEqual(CONTRIBUYENTE);
    expect(portal.llamadas).toEqual(["GET", "POST", "GET", "POST"]);
  });

  test("un no inscrito aislado no se da por bueno: se confirma en otra sesión", async () => {
    const portal = simularPortal([AVISO_NO_INSCRITO, RESULTADO_CONTRIBUYENTE]);

    await expect(consultar("rnc", "101010101")).resolves.toEqual(CONTRIBUYENTE);
    expect(portal.posts()).toBe(2);
  });

  test("dos no inscritos seguidos sí son un no encontrado y se cachean", async () => {
    const portal = simularPortal([AVISO_NO_INSCRITO]);
    const { consultarDgii } = await moduloNuevo();

    await expect(consultarDgii("rnc", "131488792")).resolves.toEqual({
      ok: false,
      error: "no_encontrado",
    });
    expect(portal.posts()).toBe(2);

    // Cacheado: la segunda búsqueda no vuelve a salir a la red.
    await expect(consultarDgii("rnc", "131488792")).resolves.toEqual({
      ok: false,
      error: "no_encontrado",
    });
    expect(portal.posts()).toBe(2);
  });

  test("un fallo del portal no se reporta como no encontrado ni se cachea", async () => {
    const portal = simularPortal([TABLA_VACIA_CON_ERROR]);
    const { consultarDgii } = await moduloNuevo();

    await expect(consultarDgii("rnc", "101010101")).resolves.toEqual({
      ok: false,
      error: "sin_datos",
    });
    expect(portal.posts()).toBe(3);

    // Sin caché: el siguiente intento vuelve a consultar el portal.
    await expect(consultarDgii("rnc", "101010101")).resolves.toEqual({
      ok: false,
      error: "sin_datos",
    });
    expect(portal.posts()).toBe(6);
  });

  test("un acierto se cachea y no se repite", async () => {
    const portal = simularPortal([RESULTADO_CONTRIBUYENTE]);
    const { consultarDgii } = await moduloNuevo();

    await expect(consultarDgii("rnc", "101010101")).resolves.toEqual(
      CONTRIBUYENTE,
    );
    await expect(consultarDgii("rnc", "101010101")).resolves.toEqual(
      CONTRIBUYENTE,
    );
    expect(portal.posts()).toBe(1);
  });

  test("un 403 bloquea las consultas por unos minutos", async () => {
    const portal = simularPortal([RESULTADO_CONTRIBUYENTE], {
      html: "<html>Acceso denegado</html>",
      status: 403,
    });
    const { consultarDgii } = await moduloNuevo();

    await expect(consultarDgii("rnc", "101010101")).resolves.toEqual({
      ok: false,
      error: "bloqueado",
    });
    const llamadasTrasElBloqueo = portal.llamadas.length;

    await expect(consultarDgii("rnc", "130893489")).resolves.toEqual({
      ok: false,
      error: "bloqueado",
    });
    expect(portal.llamadas).toHaveLength(llamadasTrasElBloqueo);
  });

  test("un error de red se reporta como red y no se cachea", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("sin conexión");
    });

    await expect(consultar("rnc", "101010101")).resolves.toEqual({
      ok: false,
      error: "red",
    });
  });
});
