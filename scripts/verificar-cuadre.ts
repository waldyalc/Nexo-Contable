import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import { centavosADecimal, decimalACentavos } from "./lib/migracion-utils";

/**
 * Verifica la integridad contable en Supabase y, opcionalmente, la compara con
 * la base SQLite de origen.
 *
 * Uso:
 *   tsx scripts/verificar-cuadre.ts [--sqlite work/nexo.sqlite] [--salida work/reporte-cuadre.md]
 *
 * Sale con código 0 si todo cuadra al centavo y con código 1 si detecta
 * cualquier descuadre o inconsistencia contable.
 */

type Fila = Record<string, unknown>;

interface Opciones {
  sqlite: string | null;
  salida: string | null;
}

interface Hallazgo {
  tipo: "error" | "aviso";
  codigo: string;
  detalle: string;
}

const TABLAS = [
  "perfiles",
  "empresas",
  "empresa_usuarios",
  "periodos_contables",
  "cuentas",
  "terceros",
  "metodos_pago",
  "secuencias_ncf",
  "asientos",
  "asiento_lineas",
  "documentos_financieros",
  "documento_pagos",
  "cuentas_bancarias",
  "movimientos_bancarios",
  "articulos_inventario",
  "movimientos_inventario",
  "activos_fijos",
  "empleados",
] as const;

const TABLAS_POR_EMPRESA = [
  "periodos_contables",
  "cuentas",
  "terceros",
  "metodos_pago",
  "secuencias_ncf",
  "asientos",
  "documentos_financieros",
  "documento_pagos",
  "cuentas_bancarias",
  "movimientos_bancarios",
  "articulos_inventario",
  "movimientos_inventario",
  "activos_fijos",
  "empleados",
] as const;

const ESTADOS_CONTABLES = new Set(["posted", "reversed", "reversal"]);

function uso(): string {
  return [
    "Uso: tsx scripts/verificar-cuadre.ts [opciones]",
    "",
    "  --sqlite <ruta>    Compara los conteos contra la base SQLite de origen.",
    "  --salida <ruta>    Escribe el reporte en Markdown en la ruta indicada.",
    "  --help             Muestra esta ayuda.",
    "",
  ].join("\n");
}

function parsearArgumentos(argv: string[]): Opciones {
  let sqlite: string | null = null;
  let salida: string | null = null;

  for (let indice = 0; indice < argv.length; indice += 1) {
    const argumento = argv[indice];
    if (argumento === undefined) continue;

    if (argumento === "--help" || argumento === "-h") {
      process.stdout.write(uso());
      process.exit(0);
    } else if (argumento === "--sqlite") {
      const valor = argv[indice + 1];
      if (!valor) throw new Error("Falta el valor de --sqlite");
      sqlite = path.resolve(process.cwd(), valor);
      indice += 1;
    } else if (argumento === "--salida") {
      const valor = argv[indice + 1];
      if (!valor) throw new Error("Falta el valor de --salida");
      salida = path.resolve(process.cwd(), valor);
      indice += 1;
    } else {
      throw new Error(`Argumento desconocido: ${argumento}`);
    }
  }

  return { sqlite, salida };
}

function cargarEnvLocal(): void {
  const ruta = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(ruta)) {
    throw new Error(
      "No existe .env.local. Define NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const contenido = fs.readFileSync(ruta, "utf8");
  for (const linea of contenido.split(/\r?\n/)) {
    const limpia = linea.trim();
    if (limpia === "" || limpia.startsWith("#")) continue;
    const separador = limpia.indexOf("=");
    if (separador <= 0) continue;
    const clave = limpia.slice(0, separador).trim();
    let valor = limpia.slice(separador + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (process.env[clave] === undefined) process.env[clave] = valor;
  }
}

function crearClienteSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !llave) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.",
    );
  }
  return createClient(url, llave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function texto(valor: unknown): string {
  if (typeof valor === "string") return valor;
  if (typeof valor === "number" || typeof valor === "bigint")
    return String(valor);
  return "";
}

async function leerFilas(
  cliente: SupabaseClient,
  tabla: string,
  columnas: string,
): Promise<Fila[]> {
  const tamano = 1000;
  const filas: Fila[] = [];

  for (let desde = 0; ; desde += tamano) {
    const { data, error } = await cliente
      .from(tabla)
      .select(columnas)
      .order("id")
      .range(desde, desde + tamano - 1);
    if (error) throw new Error(`No se pudo leer ${tabla}: ${error.message}`);
    const lote = (data ?? []) as unknown as Fila[];
    filas.push(...lote);
    if (lote.length < tamano) break;
  }

  return filas;
}

async function contar(
  cliente: SupabaseClient,
  tabla: string,
  filtro?: { columna: string; valor: string },
): Promise<number> {
  const consulta = cliente
    .from(tabla)
    .select("*", { count: "exact", head: true });
  const { count, error } = filtro
    ? await consulta.eq(filtro.columna, filtro.valor)
    : await consulta;
  if (error) throw new Error(`No se pudo contar ${tabla}: ${error.message}`);
  return count ?? 0;
}

function contarSqlite(db: DatabaseSync, tabla: string): number | null {
  const existe = db
    .prepare(
      "select 1 as existe from sqlite_master where type = 'table' and name = ?",
    )
    .get(tabla);
  if (!existe) return null;
  if (!/^[A-Za-z0-9_]+$/.test(tabla)) return null;
  const fila = db.prepare(`select count(*) as total from "${tabla}"`).get() as
    | Fila
    | undefined;
  return typeof fila?.total === "number" ? fila.total : 0;
}

function sumarCentavos(valor: unknown): bigint {
  if (valor === null || valor === undefined) return 0n;
  try {
    return decimalACentavos(valor as string | number | bigint);
  } catch {
    return 0n;
  }
}

function formatearMonto(centavos: bigint): string {
  return `RD$ ${centavosADecimal(centavos)}`;
}

function primerNombreEmpresa(
  empresas: Map<string, string>,
  empresaId: string,
): string {
  return empresas.get(empresaId) ?? empresaId;
}

interface ConteoPorEmpresa {
  empresaId: string;
  nombre: string;
  tablas: { tabla: string; total: number }[];
}

async function recolectarConteos(
  cliente: SupabaseClient,
  empresas: Map<string, string>,
): Promise<{
  porTabla: { tabla: string; total: number }[];
  porEmpresa: ConteoPorEmpresa[];
}> {
  const porTabla: { tabla: string; total: number }[] = [];
  for (const tabla of TABLAS) {
    porTabla.push({ tabla, total: await contar(cliente, tabla) });
  }

  const porEmpresa: ConteoPorEmpresa[] = [];
  for (const [empresaId, nombre] of empresas) {
    const tablas: { tabla: string; total: number }[] = [];
    for (const tabla of TABLAS_POR_EMPRESA) {
      tablas.push({
        tabla,
        total: await contar(cliente, tabla, {
          columna: "empresa_id",
          valor: empresaId,
        }),
      });
    }
    porEmpresa.push({ empresaId, nombre, tablas });
  }

  return { porTabla, porEmpresa };
}

async function verificar(cliente: SupabaseClient): Promise<{
  hallazgos: Hallazgo[];
  resumen: {
    empresas: Map<string, string>;
    asientosContabilizados: number;
    lineas: number;
    debitos: bigint;
    creditos: bigint;
    conteos: Awaited<ReturnType<typeof recolectarConteos>>;
  };
}> {
  const hallazgos: Hallazgo[] = [];

  const agregar = (
    tipo: Hallazgo["tipo"],
    codigo: string,
    detalle: string,
  ): void => {
    hallazgos.push({ tipo, codigo, detalle });
  };

  const [
    filasEmpresas,
    asientos,
    lineas,
    cuentas,
    documentos,
    pagos,
    articulos,
  ] = await Promise.all([
    leerFilas(cliente, "empresas", "id, nombre_comercial"),
    leerFilas(cliente, "asientos", "id, empresa_id, numero, estado"),
    leerFilas(
      cliente,
      "asiento_lineas",
      "id, asiento_id, empresa_id, cuenta_id, debito, credito",
    ),
    leerFilas(
      cliente,
      "cuentas",
      "id, empresa_id, codigo, es_agrupacion, padre_id",
    ),
    leerFilas(
      cliente,
      "documentos_financieros",
      "id, empresa_id, numero, estado, subtotal, impuesto, retenciones, otros_impuestos, total, asiento_id",
    ),
    leerFilas(
      cliente,
      "documento_pagos",
      "id, empresa_id, documento_id, monto, estado",
    ),
    leerFilas(
      cliente,
      "articulos_inventario",
      "id, empresa_id, sku, cantidad_disponible, valor_total",
    ),
  ]);

  const empresas = new Map<string, string>();
  for (const fila of filasEmpresas) {
    empresas.set(texto(fila.id), texto(fila.nombre_comercial));
  }

  // -----------------------------------------------------------------------
  // Cuadre de partida doble
  // -----------------------------------------------------------------------
  const asientosContables = new Map<
    string,
    { empresaId: string; numero: string; estado: string }
  >();
  const idsAsientos = new Set<string>();
  for (const fila of asientos) {
    idsAsientos.add(texto(fila.id));
    const estado = texto(fila.estado);
    if (!ESTADOS_CONTABLES.has(estado)) continue;
    asientosContables.set(texto(fila.id), {
      empresaId: texto(fila.empresa_id),
      numero: texto(fila.numero),
      estado,
    });
  }

  const lineasPorAsiento = new Map<string, Fila[]>();
  const porEmpresa = new Map<string, { debitos: bigint; creditos: bigint }>();
  let debitosGlobal = 0n;
  let creditosGlobal = 0n;
  let lineasContables = 0;

  for (const linea of lineas) {
    const asientoId = texto(linea.asiento_id);
    const asiento = asientosContables.get(asientoId);
    if (asiento === undefined) continue;

    lineasContables += 1;
    const actuales = lineasPorAsiento.get(asientoId) ?? [];
    actuales.push(linea);
    lineasPorAsiento.set(asientoId, actuales);

    if (texto(linea.empresa_id) !== asiento.empresaId) {
      agregar(
        "error",
        "linea_otra_empresa",
        `La línea del asiento ${asiento.numero} pertenece a otra empresa.`,
      );
    }

    const debito = sumarCentavos(linea.debito);
    const credito = sumarCentavos(linea.credito);
    debitosGlobal += debito;
    creditosGlobal += credito;

    const acumulado = porEmpresa.get(asiento.empresaId) ?? {
      debitos: 0n,
      creditos: 0n,
    };
    acumulado.debitos += debito;
    acumulado.creditos += credito;
    porEmpresa.set(asiento.empresaId, acumulado);
  }

  for (const [asientoId, asiento] of asientosContables) {
    const filasAsiento = lineasPorAsiento.get(asientoId) ?? [];
    if (filasAsiento.length < 2) {
      agregar(
        "error",
        "asiento_sin_lineas",
        `El asiento ${asiento.numero} (${primerNombreEmpresa(empresas, asiento.empresaId)}) tiene ${filasAsiento.length} línea(s).`,
      );
    }
  }

  const cuentaAgrupacion = new Set<string>();
  const conHijos = new Set<string>();
  for (const fila of cuentas) {
    const padre = texto(fila.padre_id);
    if (padre !== "") conHijos.add(padre);
  }
  for (const fila of cuentas) {
    const id = texto(fila.id);
    if (fila.es_agrupacion === true || conHijos.has(id))
      cuentaAgrupacion.add(id);
  }
  for (const [asientoId, asiento] of asientosContables) {
    for (const linea of lineasPorAsiento.get(asientoId) ?? []) {
      const cuentaId = texto(linea.cuenta_id);
      if (cuentaAgrupacion.has(cuentaId)) {
        agregar(
          "error",
          "cuenta_agrupacion",
          `El asiento ${asiento.numero} usa la cuenta de agrupación ${cuentaId}.`,
        );
      }
    }
  }

  for (const [empresaId, totales] of porEmpresa) {
    if (totales.debitos !== totales.creditos) {
      agregar(
        "error",
        "descuadre_empresa",
        `${primerNombreEmpresa(empresas, empresaId)}: débitos ${formatearMonto(totales.debitos)} vs créditos ${formatearMonto(totales.creditos)}.`,
      );
    }
  }

  if (debitosGlobal !== creditosGlobal) {
    agregar(
      "error",
      "descuadre_global",
      `Débitos ${formatearMonto(debitosGlobal)} vs créditos ${formatearMonto(creditosGlobal)}.`,
    );
  }

  // -----------------------------------------------------------------------
  // Documentos vs pagos
  // -----------------------------------------------------------------------
  const pagosActivosPorDocumento = new Map<string, bigint>();
  for (const pago of pagos) {
    if (texto(pago.estado) !== "active") continue;
    const documentoId = texto(pago.documento_id);
    const acumulado = pagosActivosPorDocumento.get(documentoId) ?? 0n;
    pagosActivosPorDocumento.set(
      documentoId,
      acumulado + sumarCentavos(pago.monto),
    );
  }

  for (const documento of documentos) {
    const id = texto(documento.id);
    const numero = texto(documento.numero);
    const estado = texto(documento.estado);
    const total = sumarCentavos(documento.total);

    if (estado === "posted" && texto(documento.asiento_id) === "") {
      agregar(
        "error",
        "documento_sin_asiento",
        `El documento ${numero} está contabilizado sin asiento.`,
      );
    } else if (
      texto(documento.asiento_id) !== "" &&
      !idsAsientos.has(texto(documento.asiento_id))
    ) {
      agregar(
        "error",
        "documento_asiento_inexistente",
        `El documento ${numero} referencia un asiento que no existe.`,
      );
    }

    const pagado = pagosActivosPorDocumento.get(id) ?? 0n;
    if (pagado > total) {
      agregar(
        "error",
        "pagos_exceden_total",
        `El documento ${numero} tiene pagos activos por ${formatearMonto(pagado)} y total ${formatearMonto(total)}.`,
      );
    }

    const calculado =
      sumarCentavos(documento.subtotal) +
      sumarCentavos(documento.impuesto) +
      sumarCentavos(documento.otros_impuestos) -
      sumarCentavos(documento.retenciones);
    if (calculado !== total) {
      agregar(
        "error",
        "total_inconsistente",
        `El documento ${numero} declara ${formatearMonto(total)} pero sus componentes suman ${formatearMonto(calculado)}.`,
      );
    }
  }

  // -----------------------------------------------------------------------
  // Inventario
  // -----------------------------------------------------------------------
  for (const articulo of articulos) {
    const sku = texto(articulo.sku);
    const cantidad = Number(articulo.cantidad_disponible);
    const valor = sumarCentavos(articulo.valor_total);
    if (!Number.isFinite(cantidad) || cantidad < 0) {
      agregar(
        "error",
        "inventario_cantidad_negativa",
        `El artículo ${sku} tiene cantidad disponible ${texto(articulo.cantidad_disponible)}.`,
      );
    }
    if (valor < 0n) {
      agregar(
        "error",
        "inventario_valor_negativo",
        `El artículo ${sku} tiene valor total ${formatearMonto(valor)}.`,
      );
    }
  }

  const conteos = await recolectarConteos(cliente, empresas);

  return {
    hallazgos,
    resumen: {
      empresas,
      asientosContabilizados: asientosContables.size,
      lineas: lineasContables,
      debitos: debitosGlobal,
      creditos: creditosGlobal,
      conteos,
    },
  };
}

interface ComparacionSqlite {
  tabla: string;
  supabase: number;
  sqlite: number | null;
}

function compararConSqlite(
  ruta: string,
  conteosSupabase: { tabla: string; total: number }[],
): { comparaciones: ComparacionSqlite[]; avisos: string[] } {
  if (!fs.existsSync(ruta)) {
    throw new Error(`No existe el archivo SQLite: ${ruta}`);
  }

  const db = new DatabaseSync(ruta, { readOnly: true });
  const avisos: string[] = [];
  const comparaciones: ComparacionSqlite[] = [];

  const pares: { supabase: string; sqlite: string[] }[] = [
    { supabase: "empresas", sqlite: ["empresas"] },
    {
      supabase: "empresa_usuarios",
      sqlite: ["empresa_usuarios", "usuarios_empresas"],
    },
    {
      supabase: "periodos_contables",
      sqlite: ["periodos_contables", "periodos"],
    },
    { supabase: "cuentas", sqlite: ["cuentas", "catalogo_cuentas"] },
    { supabase: "terceros", sqlite: ["terceros", "clientes_proveedores"] },
    { supabase: "metodos_pago", sqlite: ["metodos_pago", "formas_pago"] },
    { supabase: "secuencias_ncf", sqlite: ["secuencias_ncf", "secuencias"] },
    { supabase: "asientos", sqlite: ["asientos", "comprobantes"] },
    {
      supabase: "asiento_lineas",
      sqlite: ["asiento_lineas", "asientos_lineas", "detalle_asientos"],
    },
    {
      supabase: "documentos_financieros",
      sqlite: ["documentos_financieros", "documentos", "facturas"],
    },
    { supabase: "documento_pagos", sqlite: ["documento_pagos", "pagos"] },
    { supabase: "cuentas_bancarias", sqlite: ["cuentas_bancarias", "bancos"] },
    {
      supabase: "movimientos_bancarios",
      sqlite: ["movimientos_bancarios", "transacciones_bancarias"],
    },
    {
      supabase: "articulos_inventario",
      sqlite: ["articulos_inventario", "articulos"],
    },
    { supabase: "activos_fijos", sqlite: ["activos_fijos", "activos"] },
    { supabase: "empleados", sqlite: ["empleados"] },
  ];

  try {
    for (const par of pares) {
      const supabase =
        conteosSupabase.find((c) => c.tabla === par.supabase)?.total ?? 0;
      let sqlite: number | null = null;
      for (const nombre of par.sqlite) {
        const total = contarSqlite(db, nombre);
        if (total !== null) {
          sqlite = total;
          break;
        }
      }
      comparaciones.push({ tabla: par.supabase, supabase, sqlite });
      if (sqlite === null) continue;
      if (sqlite !== supabase) {
        avisos.push(
          `Diferencia en ${par.supabase}: SQLite ${sqlite} vs Supabase ${supabase}.`,
        );
      }
    }

    const tablaLineasSqlite = [
      "asiento_lineas",
      "asientos_lineas",
      "detalle_asientos",
    ].find((nombre) => contarSqlite(db, nombre) !== null);
    if (tablaLineasSqlite !== undefined) {
      const filas = db
        .prepare(`select debito, credito from "${tablaLineasSqlite}"`)
        .all() as Fila[];
      let debitos = 0n;
      let creditos = 0n;
      for (const fila of filas) {
        debitos += sumarCentavos(fila.debito);
        creditos += sumarCentavos(fila.credito);
      }
      if (debitos !== creditos) {
        avisos.push(
          `SQLite de origen descuadrado: débitos ${formatearMonto(debitos)} vs créditos ${formatearMonto(creditos)} (totales completos, sin filtrar estado).`,
        );
      }
    }
  } finally {
    db.close();
  }

  return { comparaciones, avisos };
}

function construirReporte(
  hallazgos: Hallazgo[],
  resumen: Awaited<ReturnType<typeof verificar>>["resumen"],
  comparacion: { comparaciones: ComparacionSqlite[]; avisos: string[] } | null,
): string {
  const errores = hallazgos.filter((hallazgo) => hallazgo.tipo === "error");
  const avisos = hallazgos.filter((hallazgo) => hallazgo.tipo === "aviso");
  const lineas: string[] = [
    "# Reporte de cuadre — Nexo Contable",
    "",
    `Generado: ${new Date().toISOString()}`,
    "",
    "## Resumen",
    "",
    `- Empresas: ${resumen.empresas.size}`,
    `- Asientos contabilizados: ${resumen.asientosContabilizados}`,
    `- Líneas contabilizadas: ${resumen.lineas}`,
    `- Total débitos: ${formatearMonto(resumen.debitos)}`,
    `- Total créditos: ${formatearMonto(resumen.creditos)}`,
    `- Cuadre global: ${resumen.debitos === resumen.creditos ? "✅ al centavo" : "❌ descuadrado"}`,
    "",
    "## Conteos por tabla",
    "",
    "| Tabla | Total |",
    "| --- | ---: |",
    ...resumen.conteos.porTabla.map(
      ({ tabla, total }) => `| ${tabla} | ${total} |`,
    ),
    "",
    "## Conteos por empresa",
    "",
  ];

  for (const empresa of resumen.conteos.porEmpresa) {
    lineas.push(
      `### ${empresa.nombre}`,
      "",
      "| Tabla | Total |",
      "| --- | ---: |",
    );
    lineas.push(
      ...empresa.tablas.map(({ tabla, total }) => `| ${tabla} | ${total} |`),
    );
    lineas.push("");
  }

  lineas.push("## Hallazgos", "");
  if (errores.length === 0 && avisos.length === 0) {
    lineas.push("Sin hallazgos: todos los controles pasaron.", "");
  } else {
    for (const hallazgo of errores) {
      lineas.push(`- ❌ **${hallazgo.codigo}** — ${hallazgo.detalle}`);
    }
    for (const hallazgo of avisos) {
      lineas.push(`- ⚠️ **${hallazgo.codigo}** — ${hallazgo.detalle}`);
    }
    lineas.push("");
  }

  if (comparacion !== null) {
    lineas.push(
      "## Comparación con SQLite",
      "",
      "| Tabla | SQLite | Supabase |",
      "| --- | ---: | ---: |",
    );
    for (const fila of comparacion.comparaciones) {
      lineas.push(
        `| ${fila.tabla} | ${fila.sqlite === null ? "—" : fila.sqlite} | ${fila.supabase} |`,
      );
    }
    lineas.push("");
    for (const aviso of comparacion.avisos) {
      lineas.push(`- ⚠️ ${aviso}`);
    }
    lineas.push("");
  }

  lineas.push(
    "## Veredicto",
    "",
    errores.length === 0
      ? "✅ Todo cuadra al centavo."
      : `❌ ${errores.length} inconsistencia(s) contable(s) detectada(s).`,
    "",
  );

  return lineas.join("\n");
}

async function principal(): Promise<void> {
  const opciones = parsearArgumentos(process.argv.slice(2));
  cargarEnvLocal();
  const cliente = crearClienteSupabase();

  process.stdout.write("Verificando cuadre en Supabase…\n");
  const { hallazgos, resumen } = await verificar(cliente);

  let comparacion: {
    comparaciones: ComparacionSqlite[];
    avisos: string[];
  } | null = null;
  if (opciones.sqlite !== null) {
    process.stdout.write(`Comparando contra ${opciones.sqlite}…\n`);
    comparacion = compararConSqlite(opciones.sqlite, resumen.conteos.porTabla);
    for (const aviso of comparacion.avisos) {
      hallazgos.push({
        tipo: "aviso",
        codigo: "comparacion_sqlite",
        detalle: aviso,
      });
    }
  }

  for (const hallazgo of hallazgos) {
    const icono = hallazgo.tipo === "error" ? "ERROR" : "AVISO";
    process.stdout.write(
      `[${icono}] ${hallazgo.codigo}: ${hallazgo.detalle}\n`,
    );
  }

  const errores = hallazgos.filter((hallazgo) => hallazgo.tipo === "error");
  process.stdout.write(
    `\nAsientos contabilizados: ${resumen.asientosContabilizados} · líneas: ${resumen.lineas}\n`,
  );
  process.stdout.write(
    `Débitos: ${formatearMonto(resumen.debitos)} · créditos: ${formatearMonto(resumen.creditos)}\n`,
  );

  const reporte = construirReporte(hallazgos, resumen, comparacion);
  if (opciones.salida !== null) {
    fs.mkdirSync(path.dirname(opciones.salida), { recursive: true });
    fs.writeFileSync(opciones.salida, reporte, "utf8");
    process.stdout.write(`Reporte escrito en ${opciones.salida}\n`);
  }

  if (errores.length > 0) {
    process.stdout.write(`\n❌ Cuadre fallido: ${errores.length} error(es).\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write("\n✅ Cuadre correcto al centavo.\n");
    process.exitCode = 0;
  }
}

principal().catch((error: unknown) => {
  const mensaje = error instanceof Error ? error.message : String(error);
  console.error(`\nVerificación abortada: ${mensaje}`);
  process.exitCode = 1;
});
