import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import {
  type ConfigUsuario,
  centavosADecimal,
  normalizarRnc,
  parsearConfigUsuarios,
  uuidDeterminista,
  validarPartidaDoble,
} from "./lib/migracion-utils";

/**
 * Migra una base SQLite local (Nexo/MEDOXIGAS) a Supabase sin escribir jamás
 * datos reales en este repositorio. El script vive en `scripts/`, usa la
 * service role desde `.env.local` y nunca forma parte de `src/app`.
 *
 * Uso:
 *   tsx scripts/migrar-sqlite-a-supabase.ts \
 *     --sqlite work/nexo.sqlite \
 *     [--usuarios work/usuarios-iniciales.json] \
 *     [--dry-run]
 *
 * Idempotencia: los identificadores se derivan con SHA-256 (UUID v5) de la
 * clave natural de cada fila y se insertan con `ON CONFLICT DO NOTHING`, por lo
 * que re-ejecutar la migración no duplica registros.
 */

type Fila = Record<string, unknown>;
type FilaSalida = Record<string, unknown>;

const TAMANO_LOTE = 200;

// ---------------------------------------------------------------------------
// Lectura de argumentos y entorno
// ---------------------------------------------------------------------------

interface Opciones {
  sqlite: string;
  usuarios: string | null;
  dryRun: boolean;
}

function uso(): string {
  return [
    "Uso: tsx scripts/migrar-sqlite-a-supabase.ts [opciones]",
    "",
    "  --sqlite <ruta>     Archivo SQLite de origen (por defecto work/nexo.sqlite).",
    "  --usuarios <ruta>   JSON con usuarios iniciales (por defecto work/usuarios-iniciales.json).",
    "  --dry-run           Lee y valida todo sin escribir en Supabase.",
    "  --help              Muestra esta ayuda.",
    "",
  ].join("\n");
}

function parsearArgumentos(argv: string[]): Opciones {
  let sqlite = path.resolve(process.cwd(), "work", "nexo.sqlite");
  let usuarios: string | null = path.resolve(
    process.cwd(),
    "work",
    "usuarios-iniciales.json",
  );
  let dryRun = false;

  for (let indice = 0; indice < argv.length; indice += 1) {
    const argumento = argv[indice];
    if (argumento === undefined) continue;

    if (argumento === "--dry-run") {
      dryRun = true;
    } else if (argumento === "--help" || argumento === "-h") {
      process.stdout.write(uso());
      process.exit(0);
    } else if (argumento === "--sqlite") {
      const valor = argv[indice + 1];
      if (!valor) throw new Error("Falta el valor de --sqlite");
      sqlite = path.resolve(process.cwd(), valor);
      indice += 1;
    } else if (argumento === "--usuarios") {
      const valor = argv[indice + 1];
      if (!valor) throw new Error("Falta el valor de --usuarios");
      usuarios = path.resolve(process.cwd(), valor);
      indice += 1;
    } else {
      throw new Error(`Argumento desconocido: ${argumento}`);
    }
  }

  if (usuarios !== null && !fs.existsSync(usuarios)) {
    if (argv.includes("--usuarios")) {
      throw new Error(`No existe el archivo de usuarios: ${usuarios}`);
    }
    usuarios = null;
  }

  return { sqlite, usuarios, dryRun };
}

function cargarEnvLocal(): void {
  const ruta = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(ruta)) {
    throw new Error(
      "No existe .env.local. Copia .env.example y define NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.",
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
    if (process.env[clave] === undefined) {
      process.env[clave] = valor;
    }
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

// ---------------------------------------------------------------------------
// Lectura dinámica de SQLite
// ---------------------------------------------------------------------------

class LectorSqlite {
  private readonly db: DatabaseSync;
  private readonly tablas: Set<string>;

  constructor(ruta: string) {
    if (!fs.existsSync(ruta)) {
      throw new Error(`No existe el archivo SQLite: ${ruta}`);
    }
    this.db = new DatabaseSync(ruta, { readOnly: true });
    const filas = this.db
      .prepare("select name from sqlite_master where type = 'table'")
      .all() as Fila[];
    this.tablas = new Set(
      filas.map((fila) => texto(fila.name)).filter((nombre) => nombre !== ""),
    );
  }

  existe(tabla: string): boolean {
    return this.tablas.has(tabla);
  }

  primeraTabla(...nombres: string[]): string | null {
    for (const nombre of nombres) {
      if (this.tablas.has(nombre)) return nombre;
    }
    return null;
  }

  filas(tabla: string): Fila[] {
    if (!/^[A-Za-z0-9_]+$/.test(tabla)) {
      throw new Error(`Nombre de tabla SQLite inválido: ${tabla}`);
    }
    return this.db.prepare(`select * from "${tabla}"`).all() as Fila[];
  }

  cerrar(): void {
    this.db.close();
  }
}

function leerTabla(lector: LectorSqlite, nombres: string[]): Fila[] {
  const tabla = lector.primeraTabla(...nombres);
  if (tabla === null) return [];
  return lector.filas(tabla);
}

// ---------------------------------------------------------------------------
// Coerción defensiva de valores SQLite
// ---------------------------------------------------------------------------

function texto(valor: unknown): string {
  if (typeof valor === "string") return valor;
  if (typeof valor === "number" || typeof valor === "bigint")
    return String(valor);
  return "";
}

function textoOpcional(valor: unknown): string | null {
  const limpio = texto(valor).trim();
  return limpio === "" ? null : limpio;
}

function numero(valor: unknown): number | null {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "bigint") return Number(valor);
  if (typeof valor === "string" && valor.trim() !== "") {
    const convertido = Number(valor);
    return Number.isFinite(convertido) ? convertido : null;
  }
  return null;
}

function booleano(valor: unknown, porDefecto = false): boolean {
  if (typeof valor === "boolean") return valor;
  const convertido = numero(valor);
  if (convertido !== null) return convertido !== 0;
  const limpio = texto(valor).trim().toLowerCase();
  if (["true", "1", "si", "sí", "yes"].includes(limpio)) return true;
  if (["false", "0", "no"].includes(limpio)) return false;
  return porDefecto;
}

function columna(fila: Fila, ...nombres: string[]): unknown {
  for (const nombre of nombres) {
    if (
      Object.hasOwn(fila, nombre) &&
      fila[nombre] !== null &&
      fila[nombre] !== undefined
    ) {
      return fila[nombre];
    }
  }
  return null;
}

function fecha(fila: Fila, ...nombres: string[]): string | null {
  const limpio = textoOpcional(columna(fila, ...nombres));
  if (limpio === null) return null;
  const coincidencia = /^(\d{4}-\d{2}-\d{2})/.exec(limpio);
  return coincidencia?.[1] ?? null;
}

/** Los montos de SQLite se guardan en centavos enteros. */
function centavos(valor: unknown): bigint {
  if (typeof valor === "bigint") return valor;
  if (typeof valor === "number") {
    if (!Number.isInteger(valor)) {
      throw new Error(
        `Se esperaban centavos enteros en SQLite y se recibió ${valor}`,
      );
    }
    return BigInt(valor);
  }
  if (typeof valor === "string") {
    const limpio = valor.trim();
    if (/^[+-]?\d+$/.test(limpio)) return BigInt(limpio);
  }
  if (valor === null || valor === undefined) return 0n;
  throw new Error(
    `Monto en centavos inválido en SQLite: ${JSON.stringify(valor)}`,
  );
}

function monto(fila: Fila, ...nombres: string[]): string {
  return centavosADecimal(centavos(columna(fila, ...nombres)));
}

function normalizarNombre(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function claveEmpresa(rncNormalizado: string, nombre: string): string {
  if (rncNormalizado !== "") return `rnc:${rncNormalizado}`;
  return `nombre:${normalizarNombre(nombre)}`;
}

function idDeterminista(espacio: string, ...partes: string[]): string {
  return uuidDeterminista(espacio, partes.join("|"));
}

// ---------------------------------------------------------------------------
// Plan de migración (se construye y valida antes de escribir)
// ---------------------------------------------------------------------------

interface MapasExistentes {
  empresas: Map<string, string>;
  cuentas: Map<string, string>;
  terceros: Map<string, string>;
  periodos: Map<string, string>;
  metodosPago: Map<string, string>;
  secuencias: Map<string, string>;
  asientos: Map<string, string>;
  documentos: Map<string, string>;
}

interface EmpresaInfo {
  id: string;
  rncNormalizado: string;
  nombreNormalizado: string;
  razonNormalizada: string;
}

interface EmpresaUsuarioPlan {
  email: string;
  empresaId: string;
  rol: string;
  esPrincipal: boolean;
}

interface PlanMigracion {
  usuarios: ConfigUsuario[];
  empresas: FilaSalida[];
  empresaUsuarios: EmpresaUsuarioPlan[];
  periodos: FilaSalida[];
  cuentas: FilaSalida[];
  terceros: FilaSalida[];
  metodosPago: FilaSalida[];
  secuenciasNcf: FilaSalida[];
  asientos: FilaSalida[];
  asientoLineas: FilaSalida[];
  asientosEstados: EstadoFinalAsiento[];
  asientosRevertidos: VinculoRevertido[];
  documentos: FilaSalida[];
  documentoPagos: FilaSalida[];
  cuentasBancarias: FilaSalida[];
  movimientosBancarios: FilaSalida[];
  articulos: FilaSalida[];
  movimientosInventario: FilaSalida[];
  activos: FilaSalida[];
  empleados: FilaSalida[];
  advertencias: string[];
}

function mapasVacios(): MapasExistentes {
  return {
    empresas: new Map(),
    cuentas: new Map(),
    terceros: new Map(),
    periodos: new Map(),
    metodosPago: new Map(),
    secuencias: new Map(),
    asientos: new Map(),
    documentos: new Map(),
  };
}

interface ContextoPlan {
  lector: LectorSqlite;
  existentes: MapasExistentes;
  advertencias: string[];
  empresaIdPorSqlite: Map<string, string>;
  empresaInfo: Map<string, EmpresaInfo>;
  cuentaIdPorSqlite: Map<string, string>;
  terceroIdPorSqlite: Map<string, string>;
  asientoIdPorSqlite: Map<string, string>;
  documentoIdPorSqlite: Map<string, string>;
  bancoIdPorSqlite: Map<string, string>;
  articuloIdPorSqlite: Map<string, string>;
}

function advertir(contexto: ContextoPlan, mensaje: string): void {
  contexto.advertencias.push(mensaje);
}

function construirEmpresas(contexto: ContextoPlan): FilaSalida[] {
  const filas = leerTabla(contexto.lector, ["empresas"]);
  if (filas.length === 0 && !contexto.lector.existe("empresas")) {
    throw new Error("La base SQLite no contiene la tabla `empresas`.");
  }

  const salida: FilaSalida[] = [];
  const idsUsados = new Set<string>();

  filas.forEach((fila, indice) => {
    const sqliteId = texto(columna(fila, "id"));
    if (sqliteId === "") {
      advertir(contexto, `Empresa en fila ${indice + 1} sin id; se omitió.`);
      return;
    }

    const rnc = texto(columna(fila, "rnc"));
    const rncNormalizado = normalizarRnc(
      texto(columna(fila, "rnc_normalizado")) || rnc,
    );
    const nombre =
      textoOpcional(
        columna(fila, "nombre_comercial", "nombre_comercial_empresa", "nombre"),
      ) ?? `Empresa ${indice + 1}`;
    const razon =
      textoOpcional(columna(fila, "razon_social", "razon")) ?? nombre;
    const clave = claveEmpresa(rncNormalizado, nombre);
    const id =
      contexto.existentes.empresas.get(clave) ??
      idDeterminista("empresa", clave);

    if (idsUsados.has(id)) {
      advertir(
        contexto,
        `Empresa "${nombre}" comparte clave natural con otra empresa; se omitió.`,
      );
      return;
    }
    idsUsados.add(id);

    contexto.empresaIdPorSqlite.set(sqliteId, id);
    contexto.empresaInfo.set(sqliteId, {
      id,
      rncNormalizado,
      nombreNormalizado: normalizarNombre(nombre),
      razonNormalizada: normalizarNombre(razon),
    });

    salida.push({
      id,
      nombre_comercial: nombre,
      razon_social: razon,
      rnc,
      rnc_normalizado: rncNormalizado,
      tipo_empresa: texto(columna(fila, "tipo_empresa", "tipo")),
      direccion: texto(columna(fila, "direccion")),
      telefono: texto(columna(fila, "telefono")),
      correo: texto(columna(fila, "correo", "email")),
      representante_legal: texto(
        columna(fila, "representante_legal", "representante"),
      ),
      actividad_economica: texto(
        columna(fila, "actividad_economica", "actividad"),
      ),
      fecha_inicio: fecha(fila, "fecha_inicio", "fecha_constitucion"),
      regimen_fiscal:
        textoOpcional(columna(fila, "regimen_fiscal", "regimen")) ??
        "ordinario",
      moneda_funcional:
        textoOpcional(columna(fila, "moneda_funcional", "moneda")) ?? "DOP",
      periodo_fiscal: textoOpcional(columna(fila, "periodo_fiscal")) ?? "01-12",
      estado: booleano(columna(fila, "activa", "active"), true)
        ? "active"
        : "inactive",
    });
  });

  return salida;
}

function resolverEmpresa(
  contexto: ContextoPlan,
  valor: unknown,
): string | null {
  const sqliteId = texto(valor);
  if (sqliteId !== "") {
    const porId = contexto.empresaIdPorSqlite.get(sqliteId);
    if (porId !== undefined) return porId;
  }

  const consulta = textoOpcional(valor);
  if (consulta === null) return null;
  const rnc = normalizarRnc(consulta);
  const nombre = normalizarNombre(consulta);

  for (const info of contexto.empresaInfo.values()) {
    if (rnc !== "" && info.rncNormalizado === rnc) return info.id;
    if (info.nombreNormalizado === nombre || info.razonNormalizada === nombre) {
      return info.id;
    }
  }

  return null;
}

function resolverEmpresaPorNombre(
  contexto: ContextoPlan,
  consulta: string,
): string | null {
  const rnc = normalizarRnc(consulta);
  const nombre = normalizarNombre(consulta);

  for (const info of contexto.empresaInfo.values()) {
    if (rnc !== "" && info.rncNormalizado === rnc) return info.id;
    if (info.nombreNormalizado === nombre || info.razonNormalizada === nombre) {
      return info.id;
    }
  }

  return null;
}

function construirPeriodos(contexto: ContextoPlan): FilaSalida[] {
  const filas = leerTabla(contexto.lector, ["periodos_contables", "periodos"]);
  const salida: FilaSalida[] = [];

  filas.forEach((fila, indice) => {
    const empresaId = resolverEmpresa(
      contexto,
      columna(fila, "empresa_id", "empresa"),
    );
    if (empresaId === null) {
      advertir(
        contexto,
        `Periodo en fila ${indice + 1} sin empresa válida; se omitió.`,
      );
      return;
    }

    const nombre =
      textoOpcional(columna(fila, "nombre", "descripcion")) ??
      `Periodo ${indice + 1}`;
    const fechaInicio = fecha(fila, "fecha_inicio", "inicio");
    const fechaFin = fecha(fila, "fecha_fin", "fin");
    if (fechaInicio === null || fechaFin === null || fechaFin < fechaInicio) {
      advertir(contexto, `Periodo "${nombre}" sin fechas válidas; se omitió.`);
      return;
    }

    const clave = `${empresaId}|${nombre}`;
    const id =
      contexto.existentes.periodos.get(clave) ??
      idDeterminista("periodo", clave);
    const cerrado =
      booleano(columna(fila, "cerrado"), false) ||
      texto(columna(fila, "estado")).toLowerCase() === "closed";

    salida.push({
      id,
      empresa_id: empresaId,
      nombre,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      estado: cerrado ? "closed" : "open",
      cerrado_en: cerrado ? new Date().toISOString() : null,
    });
  });

  return salida;
}

const CLASIFICACIONES = new Set([
  "asset",
  "liability",
  "equity",
  "income",
  "cost",
  "expense",
]);
const NATURALEZAS = new Set(["debit", "credit"]);
const CATEGORIAS_FLUJO = new Set([
  "operating",
  "investing",
  "financing",
  "other",
]);

function clasificacionCuenta(valor: unknown): string {
  const limpio = texto(valor).trim().toLowerCase();
  const mapa: Record<string, string> = {
    asset: "asset",
    activo: "asset",
    liability: "liability",
    pasivo: "liability",
    equity: "equity",
    patrimonio: "equity",
    capital: "equity",
    income: "income",
    ingreso: "income",
    ingresos: "income",
    cost: "cost",
    costo: "cost",
    costos: "cost",
    expense: "expense",
    gasto: "expense",
    gastos: "expense",
  };
  const resultado = mapa[limpio] ?? "asset";
  return CLASIFICACIONES.has(resultado) ? resultado : "asset";
}

function naturalezaCuenta(valor: unknown): string {
  const limpio = texto(valor).trim().toLowerCase();
  const mapa: Record<string, string> = {
    debit: "debit",
    debito: "debit",
    débito: "debit",
    credit: "credit",
    credito: "credit",
    crédito: "credit",
  };
  const resultado = mapa[limpio] ?? "debit";
  return NATURALEZAS.has(resultado) ? resultado : "debit";
}

function categoriaFlujo(valor: unknown): string {
  const limpio = texto(valor).trim().toLowerCase();
  return CATEGORIAS_FLUJO.has(limpio) ? limpio : "operating";
}

interface NodoCuenta {
  sqliteId: string;
  padreSqliteId: string | null;
  id: string;
  empresaId: string;
  fila: Fila;
}

function construirCuentas(contexto: ContextoPlan): FilaSalida[] {
  const filas = leerTabla(contexto.lector, ["cuentas", "catalogo_cuentas"]);
  const nodos: NodoCuenta[] = [];

  filas.forEach((fila, indice) => {
    const sqliteId = texto(columna(fila, "id"));
    const empresaId = resolverEmpresa(
      contexto,
      columna(fila, "empresa_id", "empresa"),
    );
    if (sqliteId === "" || empresaId === null) {
      advertir(
        contexto,
        `Cuenta en fila ${indice + 1} sin id o empresa; se omitió.`,
      );
      return;
    }

    const codigo =
      textoOpcional(columna(fila, "codigo", "code", "cuenta")) ??
      `SIN-CODIGO-${indice + 1}`;
    const clave = `${empresaId}|${codigo}`;
    const id =
      contexto.existentes.cuentas.get(clave) ?? idDeterminista("cuenta", clave);
    const padreSqliteId = textoOpcional(
      columna(fila, "padre_id", "cuenta_padre_id", "parent_id"),
    );

    nodos.push({ sqliteId, padreSqliteId, id, empresaId, fila });
    contexto.cuentaIdPorSqlite.set(sqliteId, id);
  });

  const porSqliteId = new Map(nodos.map((nodo) => [nodo.sqliteId, nodo]));
  const emitidos = new Set<string>();
  const salida: FilaSalida[] = [];

  const emitir = (
    nodo: NodoCuenta,
    padreId: string | null,
    nivel: number,
  ): void => {
    emitidos.add(nodo.sqliteId);
    const codigo =
      textoOpcional(columna(nodo.fila, "codigo", "code", "cuenta")) ??
      `SIN-CODIGO-${salida.length + 1}`;
    salida.push({
      id: nodo.id,
      empresa_id: nodo.empresaId,
      codigo,
      nombre:
        textoOpcional(columna(nodo.fila, "nombre", "name", "descripcion")) ??
        codigo,
      padre_id: padreId,
      clasificacion: clasificacionCuenta(
        columna(nodo.fila, "clasificacion", "classification"),
      ),
      naturaleza: naturalezaCuenta(
        columna(nodo.fila, "naturaleza", "normal_balance"),
      ),
      nivel: Math.max(nivel, 1),
      es_agrupacion: booleano(
        columna(nodo.fila, "es_agrupacion", "is_header"),
        false,
      ),
      activa: booleano(columna(nodo.fila, "activa", "active"), true),
      es_equivalente_efectivo: booleano(
        columna(nodo.fila, "es_equivalente_efectivo", "equivalente_efectivo"),
        false,
      ),
      categoria_flujo_efectivo: categoriaFlujo(
        columna(nodo.fila, "categoria_flujo_efectivo", "categoria_flujo"),
      ),
    });
  };

  while (emitidos.size < nodos.length) {
    const listos = nodos.filter((nodo) => {
      if (emitidos.has(nodo.sqliteId)) return false;
      if (nodo.padreSqliteId === null) return true;
      const padre = porSqliteId.get(nodo.padreSqliteId);
      return padre === undefined || emitidos.has(padre.sqliteId);
    });

    if (listos.length === 0) {
      advertir(
        contexto,
        "Se detectó un ciclo en el árbol de cuentas; las cuentas restantes se migran sin padre.",
      );
      for (const nodo of nodos) {
        if (!emitidos.has(nodo.sqliteId)) emitir(nodo, null, 1);
      }
      break;
    }

    for (const nodo of listos) {
      const padre =
        nodo.padreSqliteId === null
          ? undefined
          : porSqliteId.get(nodo.padreSqliteId);
      const padreEmitido = padre !== undefined && emitidos.has(padre.sqliteId);
      if (padreEmitido) {
        const nivelPadre = salida.find((fila) => fila.id === padre.id)?.nivel;
        const nivel = typeof nivelPadre === "number" ? nivelPadre + 1 : 2;
        emitir(nodo, padre.id, nivel);
      } else {
        emitir(nodo, null, 1);
      }
    }
  }

  return salida;
}

function tipoTercero(valor: unknown): "customer" | "supplier" | "both" {
  const limpio = texto(valor).trim().toLowerCase();
  if (
    ["customer", "cliente", "clientes", "cxc", "por_cobrar"].includes(limpio)
  ) {
    return "customer";
  }
  if (
    ["supplier", "proveedor", "proveedores", "cxp", "por_pagar"].includes(
      limpio,
    )
  ) {
    return "supplier";
  }
  return "both";
}

function construirTerceros(contexto: ContextoPlan): FilaSalida[] {
  const filas = leerTabla(contexto.lector, [
    "terceros",
    "clientes_proveedores",
  ]);
  const salida: FilaSalida[] = [];

  filas.forEach((fila, indice) => {
    const sqliteId = texto(columna(fila, "id"));
    const empresaId = resolverEmpresa(
      contexto,
      columna(fila, "empresa_id", "empresa"),
    );
    if (empresaId === null) {
      advertir(
        contexto,
        `Tercero en fila ${indice + 1} sin empresa válida; se omitió.`,
      );
      return;
    }

    const nombre =
      textoOpcional(columna(fila, "nombre", "name", "razon_social")) ??
      `Tercero ${indice + 1}`;
    const rnc = texto(columna(fila, "rnc", "cedula"));
    const rncNormalizado = normalizarRnc(
      texto(columna(fila, "rnc_normalizado")) || rnc,
    );
    const clave = `${empresaId}|${rncNormalizado !== "" ? `rnc:${rncNormalizado}` : `nombre:${normalizarNombre(nombre)}`}`;
    const id =
      contexto.existentes.terceros.get(clave) ??
      idDeterminista("tercero", clave);

    if (sqliteId !== "") contexto.terceroIdPorSqlite.set(sqliteId, id);

    const cuentaPagar = textoOpcional(
      columna(fila, "cuenta_por_pagar_id", "cuenta_cxp_id"),
    );
    const cuentaCobrar = textoOpcional(
      columna(fila, "cuenta_por_cobrar_id", "cuenta_cxc_id"),
    );

    salida.push({
      id,
      empresa_id: empresaId,
      tipo: tipoTercero(columna(fila, "tipo", "tipo_tercero")),
      nombre,
      rnc,
      rnc_normalizado: rncNormalizado,
      correo: texto(columna(fila, "correo", "email")),
      telefono: texto(columna(fila, "telefono")),
      direccion: texto(columna(fila, "direccion")),
      cuenta_por_pagar_id:
        cuentaPagar === null
          ? null
          : (contexto.cuentaIdPorSqlite.get(cuentaPagar) ?? null),
      cuenta_por_cobrar_id:
        cuentaCobrar === null
          ? null
          : (contexto.cuentaIdPorSqlite.get(cuentaCobrar) ?? null),
      activo: booleano(columna(fila, "activo", "activa"), true),
    });
  });

  return salida;
}

function construirMetodosPago(contexto: ContextoPlan): FilaSalida[] {
  const filas = leerTabla(contexto.lector, ["metodos_pago", "formas_pago"]);
  const salida: FilaSalida[] = [];

  filas.forEach((fila, indice) => {
    const empresaId = resolverEmpresa(
      contexto,
      columna(fila, "empresa_id", "empresa"),
    );
    if (empresaId === null) return;

    const nombre =
      textoOpcional(columna(fila, "nombre", "name")) ?? `Método ${indice + 1}`;
    const cuentaSqlite = textoOpcional(
      columna(fila, "cuenta_id", "cuenta_contable_id"),
    );
    const cuentaId =
      cuentaSqlite === null
        ? undefined
        : contexto.cuentaIdPorSqlite.get(cuentaSqlite);
    if (cuentaId === undefined) {
      advertir(
        contexto,
        `Método de pago "${nombre}" sin cuenta contable migrada; se omitió.`,
      );
      return;
    }

    const clave = `${empresaId}|${normalizarNombre(nombre)}`;
    const id =
      contexto.existentes.metodosPago.get(clave) ??
      idDeterminista("metodo_pago", clave);

    salida.push({
      id,
      empresa_id: empresaId,
      nombre,
      cuenta_id: cuentaId,
      deja_cxp_proveedor: booleano(
        columna(fila, "deja_cxp_proveedor", "genera_cxp"),
        false,
      ),
      activo: booleano(columna(fila, "activo", "activa"), true),
    });
  });

  return salida;
}

const TIPO_NCF = /^(B(0[1-9]|1[0-7])|E(3[1-9]|4[0-7]))$/;
const NCF_COMPLETO = /^(B(0[1-9]|1[0-7])[0-9]{8}|E(3[1-9]|4[0-7])[0-9]{10})$/;

function construirSecuenciasNcf(contexto: ContextoPlan): FilaSalida[] {
  const filas = leerTabla(contexto.lector, ["secuencias_ncf", "secuencias"]);
  const salida: FilaSalida[] = [];

  filas.forEach((fila, indice) => {
    const empresaId = resolverEmpresa(
      contexto,
      columna(fila, "empresa_id", "empresa"),
    );
    if (empresaId === null) return;

    const tipo = texto(columna(fila, "tipo_comprobante", "tipo", "tipo_ncf"))
      .trim()
      .toUpperCase();
    if (!TIPO_NCF.test(tipo)) {
      advertir(
        contexto,
        `Secuencia NCF en fila ${indice + 1} con tipo inválido "${tipo}"; se omitió.`,
      );
      return;
    }

    const prefijo =
      textoOpcional(columna(fila, "prefijo"))?.toUpperCase() ?? tipo;
    if (!prefijo.startsWith(tipo) || !/^[A-Z0-9]{3,6}$/.test(prefijo)) {
      advertir(
        contexto,
        `Secuencia NCF ${tipo} con prefijo inválido "${prefijo}"; se omitió.`,
      );
      return;
    }

    const inicial = numero(columna(fila, "numero_inicial", "desde"));
    const final = numero(columna(fila, "numero_final", "hasta"));
    if (inicial === null || final === null || inicial < 1 || final < inicial) {
      advertir(
        contexto,
        `Secuencia NCF ${prefijo} con rango inválido; se omitió.`,
      );
      return;
    }

    const actualBruto =
      numero(columna(fila, "numero_actual", "actual")) ?? inicial - 1;
    const actual = Math.min(Math.max(actualBruto, 0), final);
    const clave = `${empresaId}|${tipo}|${prefijo}|${inicial}`;
    const id =
      contexto.existentes.secuencias.get(clave) ??
      idDeterminista("secuencia_ncf", clave);

    salida.push({
      id,
      empresa_id: empresaId,
      tipo_comprobante: tipo,
      serie: tipo.charAt(0),
      prefijo,
      numero_inicial: inicial,
      numero_final: final,
      numero_actual: actual,
      fecha_vencimiento: fecha(fila, "fecha_vencimiento", "vencimiento"),
      activo: booleano(columna(fila, "activo", "activa"), true),
    });
  });

  return salida;
}

function estadoAsiento(
  valor: unknown,
): "draft" | "posted" | "reversed" | "reversal" {
  const limpio = texto(valor).trim().toLowerCase();
  if (["draft", "borrador", "pendiente"].includes(limpio)) return "draft";
  if (["reversal", "reverso", "contra_asiento"].includes(limpio))
    return "reversal";
  if (["reversed", "anulado", "revertido"].includes(limpio)) return "reversed";
  return "posted";
}

interface VinculoRevertido {
  asientoId: string;
  revertidoPor: string;
}

interface EstadoFinalAsiento {
  id: string;
  estado: string;
}

interface AsientosConstruidos {
  asientos: FilaSalida[];
  lineas: FilaSalida[];
  estados: EstadoFinalAsiento[];
  revertidos: VinculoRevertido[];
}

function construirAsientos(contexto: ContextoPlan): AsientosConstruidos {
  const filasAsientos = leerTabla(contexto.lector, [
    "asientos",
    "comprobantes",
  ]);
  const filasLineas = leerTabla(contexto.lector, [
    "asiento_lineas",
    "asientos_lineas",
    "detalle_asientos",
    "comprobantes_detalle",
  ]);
  if (filasAsientos.length > 0 && contexto.cuentaIdPorSqlite.size === 0) {
    throw new Error(
      "La base SQLite tiene asientos pero no cuentas contables migrables; abortando.",
    );
  }

  const lineasPorAsiento = new Map<string, Fila[]>();
  for (const linea of filasLineas) {
    const asientoSqlite = texto(
      columna(linea, "asiento_id", "comprobante_id", "asiento"),
    );
    if (asientoSqlite === "") continue;
    const actuales = lineasPorAsiento.get(asientoSqlite) ?? [];
    actuales.push(linea);
    lineasPorAsiento.set(asientoSqlite, actuales);
  }

  const asientos: FilaSalida[] = [];
  const lineas: FilaSalida[] = [];
  const estados: EstadoFinalAsiento[] = [];
  const numerosUsados = new Set<string>();
  const referencias: {
    fila: FilaSalida;
    reverso: string | null;
    revertidoPor: string | null;
  }[] = [];

  filasAsientos.forEach((fila, indice) => {
    const sqliteId = texto(columna(fila, "id"));
    const empresaId = resolverEmpresa(
      contexto,
      columna(fila, "empresa_id", "empresa"),
    );
    if (sqliteId === "" || empresaId === null) {
      advertir(
        contexto,
        `Asiento en fila ${indice + 1} sin id o empresa; se omitió.`,
      );
      return;
    }

    const estado = estadoAsiento(columna(fila, "estado", "status"));
    const numeroAsiento =
      textoOpcional(columna(fila, "numero", "numero_asiento", "codigo")) ??
      `JE-MIG-${sqliteId.slice(0, 8)}`;
    const claveNumero = `${empresaId}|${numeroAsiento}`;
    if (numerosUsados.has(claveNumero)) {
      throw new Error(
        `Número de asiento duplicado en la empresa: ${numeroAsiento}`,
      );
    }
    numerosUsados.add(claveNumero);

    const id =
      contexto.existentes.asientos.get(claveNumero) ??
      idDeterminista("asiento", `${empresaId}|${sqliteId}`);

    const fechaAsiento = fecha(fila, "fecha", "fecha_asiento");
    if (fechaAsiento === null) {
      advertir(
        contexto,
        `Asiento ${numeroAsiento} sin fecha válida; se omitió.`,
      );
      return;
    }
    contexto.asientoIdPorSqlite.set(sqliteId, id);

    const filasDelAsiento = [...(lineasPorAsiento.get(sqliteId) ?? [])].sort(
      (a, b) =>
        (numero(columna(a, "linea", "numero_linea", "orden")) ?? 0) -
        (numero(columna(b, "linea", "numero_linea", "orden")) ?? 0),
    );
    if (estado !== "draft" && filasDelAsiento.length === 0) {
      throw new Error(
        `El asiento ${numeroAsiento} está contabilizado y no tiene líneas.`,
      );
    }

    const lineasSalida: FilaSalida[] = [];
    const lineasValidadas: { debitoCents: bigint; creditoCents: bigint }[] = [];

    filasDelAsiento.forEach((linea, posicion) => {
      const cuentaSqlite = textoOpcional(
        columna(linea, "cuenta_id", "cuenta", "cuenta_contable_id"),
      );
      const cuentaId =
        cuentaSqlite === null
          ? undefined
          : contexto.cuentaIdPorSqlite.get(cuentaSqlite);
      if (cuentaId === undefined) {
        throw new Error(
          `El asiento ${numeroAsiento} referencia una cuenta no migrada.`,
        );
      }

      const debitoCents = centavos(
        columna(linea, "debito", "debe", "debito_cents"),
      );
      const creditoCents = centavos(
        columna(linea, "credito", "haber", "credito_cents"),
      );
      lineasValidadas.push({ debitoCents, creditoCents });

      if (
        (debitoCents > 0n && creditoCents > 0n) ||
        (debitoCents === 0n && creditoCents === 0n)
      ) {
        if (estado !== "draft") {
          throw new Error(
            `El asiento ${numeroAsiento} tiene una línea sin un único lado (débito/crédito).`,
          );
        }
        advertir(
          contexto,
          `Asiento ${numeroAsiento} en borrador con línea vacía o doble; se omitió la línea.`,
        );
        return;
      }

      lineasSalida.push({
        id: idDeterminista("asiento_linea", `${id}|${posicion + 1}`),
        asiento_id: id,
        empresa_id: empresaId,
        linea: posicion + 1,
        cuenta_id: cuentaId,
        descripcion: texto(columna(linea, "descripcion", "concepto")),
        debito: centavosADecimal(debitoCents),
        credito: centavosADecimal(creditoCents),
      });
    });

    if (estado !== "draft") {
      const validacion = validarPartidaDoble(lineasValidadas);
      if (!validacion.valido) {
        throw new Error(
          `El asiento ${numeroAsiento} no cumple partida doble: ${validacion.errores.join("; ")}`,
        );
      }
    }

    const filaSalida: FilaSalida = {
      id,
      empresa_id: empresaId,
      numero: numeroAsiento,
      fecha: fechaAsiento,
      tipo_operacion:
        textoOpcional(columna(fila, "tipo_operacion", "tipo")) ?? "manual",
      descripcion:
        textoOpcional(columna(fila, "descripcion", "concepto")) ??
        `Asiento migrado ${numeroAsiento}`,
      referencia: texto(columna(fila, "referencia")),
      // Se insertan como borrador para que el trigger diferido de cuadre no
      // valide el asiento antes de que existan sus líneas. El estado final se
      // aplica después de insertar `asiento_lineas`.
      estado: "draft",
      reverso_de: null,
      revertido_por: null,
      contabilizado_en: null,
    };
    asientos.push(filaSalida);
    estados.push({ id, estado });
    referencias.push({
      fila: filaSalida,
      reverso: textoOpcional(
        columna(fila, "reverso_de", "asiento_original_id"),
      ),
      revertidoPor: textoOpcional(
        columna(fila, "revertido_por", "asiento_reverso_id"),
      ),
    });

    lineas.push(...lineasSalida);
  });

  for (const referencia of referencias) {
    if (referencia.reverso !== null) {
      referencia.fila.reverso_de =
        contexto.asientoIdPorSqlite.get(referencia.reverso) ?? null;
    }
  }

  const revertidos: VinculoRevertido[] = [];
  for (const referencia of referencias) {
    if (referencia.revertidoPor === null) continue;
    const target = contexto.asientoIdPorSqlite.get(referencia.revertidoPor);
    if (target === undefined) continue;
    revertidos.push({
      asientoId: texto(referencia.fila.id),
      revertidoPor: target,
    });
  }

  // Las facturas de reverso deben insertarse después de sus asientos originales
  // porque la FK `asientos_reverso_de_fk` se valida de inmediato.
  asientos.sort((a, b) => {
    const prioridad = (valor: unknown): number => (valor === null ? 0 : 1);
    return prioridad(a.reverso_de) - prioridad(b.reverso_de);
  });

  return { asientos, lineas, estados, revertidos };
}

function tipoDocumento(
  valor: unknown,
):
  | "sales_invoice"
  | "purchase_invoice"
  | "sales_credit"
  | "purchase_credit"
  | null {
  const limpio = texto(valor)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const mapa: Record<
    string,
    "sales_invoice" | "purchase_invoice" | "sales_credit" | "purchase_credit"
  > = {
    sales_invoice: "sales_invoice",
    factura_venta: "sales_invoice",
    factura_de_venta: "sales_invoice",
    venta: "sales_invoice",
    purchase_invoice: "purchase_invoice",
    factura_compra: "purchase_invoice",
    factura_de_compra: "purchase_invoice",
    compra: "purchase_invoice",
    sales_credit: "sales_credit",
    nota_credito_venta: "sales_credit",
    nota_de_credito_venta: "sales_credit",
    purchase_credit: "purchase_credit",
    nota_credito_compra: "purchase_credit",
    nota_de_credito_compra: "purchase_credit",
  };
  return mapa[limpio] ?? null;
}

function estadoDocumento(valor: unknown): "draft" | "posted" | "void" {
  const limpio = texto(valor).trim().toLowerCase();
  if (["draft", "borrador"].includes(limpio)) return "draft";
  if (["void", "anulado", "cancelado"].includes(limpio)) return "void";
  return "posted";
}

interface DocumentosConstruidos {
  documentos: FilaSalida[];
  pagos: FilaSalida[];
}

function construirDocumentos(contexto: ContextoPlan): DocumentosConstruidos {
  const filas = leerTabla(contexto.lector, [
    "documentos_financieros",
    "documentos",
    "facturas",
  ]);
  const documentos: FilaSalida[] = [];
  const empresaPorDocumento = new Map<string, string>();
  const acreditadosPendientes = new Map<string, string>();

  filas.forEach((fila, indice) => {
    const sqliteId = texto(columna(fila, "id"));
    const empresaId = resolverEmpresa(
      contexto,
      columna(fila, "empresa_id", "empresa"),
    );
    if (empresaId === null) return;

    const tipo = tipoDocumento(columna(fila, "tipo", "tipo_documento"));
    if (tipo === null) {
      advertir(
        contexto,
        `Documento en fila ${indice + 1} con tipo desconocido; se omitió.`,
      );
      return;
    }

    const numero =
      textoOpcional(columna(fila, "numero", "numero_documento", "codigo")) ??
      `DOC-MIG-${indice + 1}`;
    const terceroSqlite = textoOpcional(
      columna(fila, "tercero_id", "cliente_id", "proveedor_id"),
    );
    const terceroId =
      terceroSqlite === null
        ? undefined
        : contexto.terceroIdPorSqlite.get(terceroSqlite);
    if (terceroId === undefined) {
      advertir(contexto, `Documento ${numero} sin tercero migrado; se omitió.`);
      return;
    }

    const cuentaSqlite = textoOpcional(columna(fila, "cuenta_id"));
    const controlSqlite = textoOpcional(
      columna(fila, "cuenta_control_id", "cuenta_por_cobrar_pagar_id"),
    );
    const cuentaId =
      cuentaSqlite === null
        ? undefined
        : contexto.cuentaIdPorSqlite.get(cuentaSqlite);
    const controlId =
      controlSqlite === null
        ? undefined
        : contexto.cuentaIdPorSqlite.get(controlSqlite);
    if (cuentaId === undefined || controlId === undefined) {
      advertir(
        contexto,
        `Documento ${numero} sin cuentas contables migradas; se omitió.`,
      );
      return;
    }

    const ncf = texto(columna(fila, "ncf", "numero_comprobante")).toUpperCase();
    if (ncf !== "" && !NCF_COMPLETO.test(ncf)) {
      advertir(
        contexto,
        `Documento ${numero} con NCF inválido "${ncf}"; se omitió.`,
      );
      return;
    }
    const tipoNcf =
      textoOpcional(columna(fila, "tipo_ncf"))?.toUpperCase() ??
      (ncf !== "" ? ncf.slice(0, 3) : "");
    if (tipoNcf !== "" && !TIPO_NCF.test(tipoNcf)) {
      advertir(
        contexto,
        `Documento ${numero} con tipo de comprobante inválido "${tipoNcf}"; se omitió.`,
      );
      return;
    }

    const subtotal = centavos(columna(fila, "subtotal", "monto_subtotal"));
    const impuesto = centavos(columna(fila, "impuesto", "itbis", "impuestos"));
    const retenciones = centavos(columna(fila, "retenciones", "retencion"));
    const otros = centavos(columna(fila, "otros_impuestos", "otros"));
    const totalFuente = columna(fila, "total", "monto_total");
    const total =
      totalFuente === null
        ? subtotal + impuesto + otros - retenciones
        : centavos(totalFuente);
    if (total <= 0n) {
      advertir(
        contexto,
        `Documento ${numero} con total no positivo; se omitió.`,
      );
      return;
    }

    const emision = fecha(fila, "fecha_emision", "fecha");
    if (emision === null) {
      advertir(
        contexto,
        `Documento ${numero} sin fecha de emisión; se omitió.`,
      );
      return;
    }

    const acreditadoSqlite = textoOpcional(
      columna(fila, "documento_acreditado_id"),
    );

    const clave = `${empresaId}|${numero}`;
    const id =
      contexto.existentes.documentos.get(clave) ??
      idDeterminista("documento", clave);
    contexto.documentoIdPorSqlite.set(sqliteId, id);
    empresaPorDocumento.set(id, empresaId);
    if (acreditadoSqlite !== null) {
      acreditadosPendientes.set(id, acreditadoSqlite);
    }

    documentos.push({
      id,
      empresa_id: empresaId,
      tipo,
      numero,
      ncf,
      tipo_ncf: tipoNcf,
      tercero_id: terceroId,
      fecha_emision: emision,
      fecha_vencimiento: fecha(fila, "fecha_vencimiento", "vencimiento"),
      concepto:
        textoOpcional(columna(fila, "concepto", "descripcion")) ??
        `Documento migrado ${numero}`,
      subtotal: centavosADecimal(subtotal),
      impuesto: centavosADecimal(impuesto),
      retenciones: centavosADecimal(retenciones),
      otros_impuestos: centavosADecimal(otros),
      total: centavosADecimal(total),
      detalles_fiscales: {},
      cuenta_id: cuentaId,
      cuenta_control_id: controlId,
      cuenta_impuesto_id: mapearCuentaOpcional(
        contexto,
        fila,
        "cuenta_impuesto_id",
      ),
      cuenta_retencion_id: mapearCuentaOpcional(
        contexto,
        fila,
        "cuenta_retencion_id",
      ),
      documento_acreditado_id: null,
      estado: estadoDocumento(columna(fila, "estado", "status")),
      asiento_id: mapearAsientoOpcional(contexto, fila),
    });
  });

  for (const [documentoId, acreditadoSqlite] of acreditadosPendientes) {
    const fila = documentos.find((documento) => documento.id === documentoId);
    if (fila === undefined) continue;
    fila.documento_acreditado_id =
      contexto.documentoIdPorSqlite.get(acreditadoSqlite) ?? null;
  }

  // Las facturas deben insertarse antes que sus notas de crédito (FK inmediata).
  documentos.sort((a, b) => {
    const prioridad = (tipo: unknown): number =>
      tipo === "sales_invoice" || tipo === "purchase_invoice" ? 0 : 1;
    return prioridad(a.tipo) - prioridad(b.tipo);
  });

  const filasPagos = leerTabla(contexto.lector, ["documento_pagos", "pagos"]);
  const pagos: FilaSalida[] = [];

  filasPagos.forEach((fila, indice) => {
    const documentoId = mapearDocumento(contexto, fila);
    if (documentoId === null) return;

    const fechaPago = fecha(fila, "fecha_pago", "fecha");
    const montoPago = centavos(columna(fila, "monto", "monto_pago"));
    if (fechaPago === null || montoPago <= 0n) {
      advertir(
        contexto,
        `Pago en fila ${indice + 1} sin fecha o monto válido; se omitió.`,
      );
      return;
    }

    const cuentaId = mapearCuentaOpcional(contexto, fila, "cuenta_id");
    if (cuentaId === null) {
      advertir(
        contexto,
        `Pago en fila ${indice + 1} sin cuenta migrada; se omitió.`,
      );
      return;
    }

    const sqliteId = texto(columna(fila, "id")) || `fila-${indice + 1}`;
    const empresaId = empresaPorDocumento.get(documentoId);
    if (empresaId === undefined) {
      advertir(
        contexto,
        `Pago en fila ${indice + 1} sin empresa conocida; se omitió.`,
      );
      return;
    }
    pagos.push({
      id: idDeterminista("pago", `${documentoId}|${sqliteId}`),
      empresa_id: empresaId,
      documento_id: documentoId,
      fecha_pago: fechaPago,
      monto: centavosADecimal(montoPago),
      metodo_pago: texto(columna(fila, "metodo_pago", "forma_pago")),
      cuenta_id: cuentaId,
      referencia: texto(columna(fila, "referencia")),
      asiento_id: mapearAsientoOpcional(contexto, fila),
      estado: ["cancelled", "anulado", "cancelado"].includes(
        texto(columna(fila, "estado")).trim().toLowerCase(),
      )
        ? "cancelled"
        : "active",
    });
  });

  return { documentos, pagos };
}

function mapearCuentaOpcional(
  contexto: ContextoPlan,
  fila: Fila,
  nombre: string,
): string | null {
  const valor = textoOpcional(columna(fila, nombre));
  if (valor === null) return null;
  return contexto.cuentaIdPorSqlite.get(valor) ?? null;
}

function mapearAsientoOpcional(
  contexto: ContextoPlan,
  fila: Fila,
): string | null {
  const valor = textoOpcional(columna(fila, "asiento_id", "comprobante_id"));
  if (valor === null) return null;
  return contexto.asientoIdPorSqlite.get(valor) ?? null;
}

function mapearDocumento(contexto: ContextoPlan, fila: Fila): string | null {
  const valor = textoOpcional(columna(fila, "documento_id", "factura_id"));
  if (valor === null) return null;
  return contexto.documentoIdPorSqlite.get(valor) ?? null;
}

function tipoMovimientoBancario(valor: unknown): string {
  const limpio = texto(valor).trim().toLowerCase();
  const mapa: Record<string, string> = {
    deposit: "deposit",
    deposito: "deposit",
    depósito: "deposit",
    credito: "deposit",
    crédito: "deposit",
    withdrawal: "withdrawal",
    retiro: "withdrawal",
    debito: "withdrawal",
    débito: "withdrawal",
    transfer: "transfer",
    transferencia: "transfer",
    fee: "fee",
    comision: "fee",
    comisión: "fee",
    interest: "interest",
    interes: "interest",
    interés: "interest",
  };
  return mapa[limpio] ?? "deposit";
}

function construirBancos(contexto: ContextoPlan): {
  cuentas: FilaSalida[];
  movimientos: FilaSalida[];
} {
  const filas = leerTabla(contexto.lector, ["cuentas_bancarias", "bancos"]);
  const cuentas: FilaSalida[] = [];
  const empresaPorBanco = new Map<string, string>();

  filas.forEach((fila, indice) => {
    const sqliteId = texto(columna(fila, "id"));
    const empresaId = resolverEmpresa(
      contexto,
      columna(fila, "empresa_id", "empresa"),
    );
    if (empresaId === null) return;

    const nombre =
      textoOpcional(columna(fila, "nombre", "name")) ??
      `Cuenta bancaria ${indice + 1}`;
    const cuentaContable = textoOpcional(
      columna(fila, "cuenta_contable_id", "cuenta_id"),
    );
    const cuentaContableId =
      cuentaContable === null
        ? undefined
        : contexto.cuentaIdPorSqlite.get(cuentaContable);
    if (cuentaContableId === undefined) {
      advertir(
        contexto,
        `Cuenta bancaria "${nombre}" sin cuenta contable; se omitió.`,
      );
      return;
    }

    const clave = `${empresaId}|${normalizarNombre(nombre)}`;
    const id = idDeterminista("cuenta_bancaria", clave);
    if (sqliteId !== "") {
      contexto.bancoIdPorSqlite.set(sqliteId, id);
      empresaPorBanco.set(id, empresaId);
    }

    cuentas.push({
      id,
      empresa_id: empresaId,
      nombre,
      banco: texto(columna(fila, "banco", "institucion")),
      numero_cuenta: texto(columna(fila, "numero_cuenta", "numero")),
      moneda: textoOpcional(columna(fila, "moneda")) ?? "DOP",
      cuenta_contable_id: cuentaContableId,
      saldo_inicial: monto(fila, "saldo_inicial", "saldo"),
      activa: booleano(columna(fila, "activa", "activo"), true),
    });
  });

  const filasMovimientos = leerTabla(contexto.lector, [
    "movimientos_bancarios",
    "transacciones_bancarias",
  ]);
  const movimientos: FilaSalida[] = [];

  filasMovimientos.forEach((fila, indice) => {
    const bancoSqlite = textoOpcional(
      columna(fila, "cuenta_bancaria_id", "banco_id"),
    );
    const cuentaBancariaId =
      bancoSqlite === null
        ? undefined
        : contexto.bancoIdPorSqlite.get(bancoSqlite);
    if (cuentaBancariaId === undefined) {
      advertir(
        contexto,
        `Movimiento bancario en fila ${indice + 1} sin cuenta migrada; se omitió.`,
      );
      return;
    }

    const fechaMovimiento = fecha(fila, "fecha");
    const montoMovimiento = centavos(columna(fila, "monto"));
    if (fechaMovimiento === null || montoMovimiento <= 0n) {
      advertir(
        contexto,
        `Movimiento bancario en fila ${indice + 1} sin fecha o monto; se omitió.`,
      );
      return;
    }

    const empresaId = empresaPorBanco.get(cuentaBancariaId);
    if (empresaId === undefined) {
      advertir(
        contexto,
        `Movimiento bancario en fila ${indice + 1} sin empresa conocida; se omitió.`,
      );
      return;
    }
    const sqliteId = texto(columna(fila, "id")) || `fila-${indice + 1}`;

    movimientos.push({
      id: idDeterminista(
        "movimiento_bancario",
        `${cuentaBancariaId}|${sqliteId}`,
      ),
      empresa_id: empresaId,
      cuenta_bancaria_id: cuentaBancariaId,
      fecha: fechaMovimiento,
      descripcion: texto(columna(fila, "descripcion", "concepto")),
      referencia: texto(columna(fila, "referencia")),
      tipo: tipoMovimientoBancario(columna(fila, "tipo")),
      monto: centavosADecimal(montoMovimiento),
      conciliado: booleano(columna(fila, "conciliado"), false),
      asiento_id: mapearAsientoOpcional(contexto, fila),
    });
  });

  return { cuentas, movimientos };
}

function construirInventario(contexto: ContextoPlan): {
  articulos: FilaSalida[];
  movimientos: FilaSalida[];
} {
  const filas = leerTabla(contexto.lector, [
    "articulos_inventario",
    "articulos",
  ]);
  const articulos: FilaSalida[] = [];

  filas.forEach((fila, indice) => {
    const sqliteId = texto(columna(fila, "id"));
    const empresaId = resolverEmpresa(
      contexto,
      columna(fila, "empresa_id", "empresa"),
    );
    if (empresaId === null) return;

    const sku =
      textoOpcional(columna(fila, "sku", "codigo")) ?? `SKU-MIG-${indice + 1}`;
    const nombre =
      textoOpcional(columna(fila, "nombre", "name")) ??
      `Artículo ${indice + 1}`;
    const clave = `${empresaId}|${sku}`;
    const id = idDeterminista("articulo", clave);
    const cantidadDisponible =
      numero(columna(fila, "cantidad_disponible", "existencia")) ?? 0;
    if (cantidadDisponible < 0) {
      advertir(
        contexto,
        `Artículo ${sku} con cantidad disponible negativa en SQLite; se omitió.`,
      );
      return;
    }
    if (sqliteId !== "") contexto.articuloIdPorSqlite.set(sqliteId, id);

    articulos.push({
      id,
      empresa_id: empresaId,
      sku,
      nombre,
      descripcion: texto(columna(fila, "descripcion")),
      unidad: textoOpcional(columna(fila, "unidad")) ?? "UNIDAD",
      cantidad_disponible: cantidadDisponible.toFixed(4),
      costo_promedio: monto(fila, "costo_promedio", "costo"),
      valor_total: monto(fila, "valor_total", "valor"),
      precio_venta: monto(fila, "precio_venta", "precio"),
      cuenta_inventario_id: mapearCuentaOpcional(
        contexto,
        fila,
        "cuenta_inventario_id",
      ),
      cuenta_costo_id: mapearCuentaOpcional(contexto, fila, "cuenta_costo_id"),
      cuenta_ingreso_id: mapearCuentaOpcional(
        contexto,
        fila,
        "cuenta_ingreso_id",
      ),
      activo: booleano(columna(fila, "activo", "activa"), true),
    });
  });

  const filasMovimientos = leerTabla(contexto.lector, [
    "movimientos_inventario",
  ]);
  const movimientos: FilaSalida[] = [];

  filasMovimientos.forEach((fila, indice) => {
    const articuloSqlite = textoOpcional(
      columna(fila, "articulo_id", "producto_id"),
    );
    const articuloId =
      articuloSqlite === null
        ? undefined
        : contexto.articuloIdPorSqlite.get(articuloSqlite);
    if (articuloId === undefined) return;

    const tipoBruto = texto(columna(fila, "tipo", "tipo_movimiento"))
      .trim()
      .toLowerCase();
    const tipo = ["in", "entrada", "compra"].includes(tipoBruto)
      ? "in"
      : ["out", "salida", "venta"].includes(tipoBruto)
        ? "out"
        : "adjustment";
    const cantidadMovimiento = Math.abs(numero(columna(fila, "cantidad")) ?? 0);
    if (cantidadMovimiento <= 0) {
      advertir(
        contexto,
        `Movimiento de inventario en fila ${indice + 1} sin cantidad; se omitió.`,
      );
      return;
    }

    const fechaMovimiento = fecha(fila, "fecha");
    if (fechaMovimiento === null) {
      advertir(
        contexto,
        `Movimiento de inventario en fila ${indice + 1} sin fecha; se omitió.`,
      );
      return;
    }

    const sqliteId = texto(columna(fila, "id")) || `fila-${indice + 1}`;
    const articulo = articulos.find((item) => item.id === articuloId);

    movimientos.push({
      id: idDeterminista("movimiento_inventario", `${articuloId}|${sqliteId}`),
      empresa_id: articulo?.empresa_id ?? "",
      articulo_id: articuloId,
      fecha: fechaMovimiento,
      tipo,
      cantidad: cantidadMovimiento.toFixed(4),
      costo_unitario: monto(fila, "costo_unitario"),
      costo_total: monto(fila, "costo_total"),
      referencia: texto(columna(fila, "referencia")),
      notas: texto(columna(fila, "notas")),
      asiento_id: mapearAsientoOpcional(contexto, fila),
    });
  });

  return { articulos, movimientos };
}

function construirActivos(contexto: ContextoPlan): FilaSalida[] {
  const filas = leerTabla(contexto.lector, ["activos_fijos", "activos"]);
  const salida: FilaSalida[] = [];

  filas.forEach((fila, indice) => {
    const empresaId = resolverEmpresa(
      contexto,
      columna(fila, "empresa_id", "empresa"),
    );
    if (empresaId === null) return;

    const codigo =
      textoOpcional(columna(fila, "codigo", "code")) ?? `AF-MIG-${indice + 1}`;
    const nombre =
      textoOpcional(columna(fila, "nombre", "name")) ?? `Activo ${indice + 1}`;
    const adquisicion = fecha(fila, "fecha_adquisicion", "fecha_compra");
    const costo = centavos(columna(fila, "costo_adquisicion", "costo"));
    const vida = numero(columna(fila, "vida_util_meses", "vida_util"));
    const cuentaActivo = mapearCuentaOpcional(
      contexto,
      fila,
      "cuenta_activo_id",
    );
    const cuentaDepreciacion = mapearCuentaOpcional(
      contexto,
      fila,
      "cuenta_depreciacion_acumulada_id",
    );
    const cuentaGasto = mapearCuentaOpcional(
      contexto,
      fila,
      "cuenta_gasto_depreciacion_id",
    );

    if (
      adquisicion === null ||
      costo <= 0n ||
      vida === null ||
      vida <= 0 ||
      cuentaActivo === null ||
      cuentaDepreciacion === null ||
      cuentaGasto === null
    ) {
      advertir(
        contexto,
        `Activo fijo "${codigo}" incompleto (fecha, costo, vida o cuentas); se omitió.`,
      );
      return;
    }

    const estadoBruto = texto(columna(fila, "estado")).trim().toLowerCase();
    const estado = ["fully_depreciated", "depreciado_total"].includes(
      estadoBruto,
    )
      ? "fully_depreciated"
      : ["disposed", "dado_de_baja", "vendido"].includes(estadoBruto)
        ? "disposed"
        : "active";

    salida.push({
      id: idDeterminista("activo_fijo", `${empresaId}|${codigo}`),
      empresa_id: empresaId,
      codigo,
      nombre,
      categoria: texto(columna(fila, "categoria")),
      fecha_adquisicion: adquisicion,
      costo_adquisicion: centavosADecimal(costo),
      valor_residual: monto(fila, "valor_residual"),
      vida_util_meses: Math.trunc(vida),
      depreciacion_acumulada: monto(fila, "depreciacion_acumulada"),
      cuenta_activo_id: cuentaActivo,
      cuenta_depreciacion_acumulada_id: cuentaDepreciacion,
      cuenta_gasto_depreciacion_id: cuentaGasto,
      estado,
    });
  });

  return salida;
}

function construirEmpleados(contexto: ContextoPlan): FilaSalida[] {
  const filas = leerTabla(contexto.lector, ["empleados"]);
  const salida: FilaSalida[] = [];

  filas.forEach((fila, indice) => {
    const empresaId = resolverEmpresa(
      contexto,
      columna(fila, "empresa_id", "empresa"),
    );
    if (empresaId === null) return;

    const codigo =
      textoOpcional(columna(fila, "codigo", "code")) ?? `EMP-MIG-${indice + 1}`;
    const nombre =
      textoOpcional(columna(fila, "nombre", "name")) ??
      `Empleado ${indice + 1}`;

    salida.push({
      id: idDeterminista("empleado", `${empresaId}|${codigo}`),
      empresa_id: empresaId,
      codigo,
      nombre,
      cedula: texto(columna(fila, "cedula", "documento")),
      cargo: texto(columna(fila, "cargo", "puesto")),
      departamento: texto(columna(fila, "departamento")),
      fecha_ingreso:
        fecha(fila, "fecha_ingreso", "fecha_contratacion") ??
        new Date().toISOString().slice(0, 10),
      salario_mensual: monto(fila, "salario_mensual", "salario"),
      activo: booleano(columna(fila, "activo", "activa"), true),
    });
  });

  return salida;
}

function construirEmpresaUsuarios(
  contexto: ContextoPlan,
  usuarios: ConfigUsuario[],
): EmpresaUsuarioPlan[] {
  const salida: EmpresaUsuarioPlan[] = [];
  const conPrincipal = new Set<string>();

  for (const usuario of usuarios) {
    for (const asignacion of usuario.empresas ?? []) {
      const empresaId = resolverEmpresaPorNombre(
        contexto,
        asignacion.rnc_o_nombre,
      );
      if (empresaId === null) {
        throw new Error(
          `El usuario ${usuario.email} referencia la empresa "${asignacion.rnc_o_nombre}", que no existe en SQLite.`,
        );
      }

      let esPrincipal = asignacion.es_principal ?? false;
      if (esPrincipal && conPrincipal.has(usuario.email)) {
        contexto.advertencias.push(
          `El usuario ${usuario.email} tiene más de una empresa principal; se conservó la primera.`,
        );
        esPrincipal = false;
      }
      if (esPrincipal) conPrincipal.add(usuario.email);

      salida.push({
        email: usuario.email,
        empresaId,
        rol: asignacion.rol,
        esPrincipal,
      });
    }
  }

  return salida;
}

function construirPlan(
  lector: LectorSqlite,
  usuarios: ConfigUsuario[],
  existentes: MapasExistentes,
): PlanMigracion {
  const contexto: ContextoPlan = {
    lector,
    existentes,
    advertencias: [],
    empresaIdPorSqlite: new Map(),
    empresaInfo: new Map(),
    cuentaIdPorSqlite: new Map(),
    terceroIdPorSqlite: new Map(),
    asientoIdPorSqlite: new Map(),
    documentoIdPorSqlite: new Map(),
    bancoIdPorSqlite: new Map(),
    articuloIdPorSqlite: new Map(),
  };

  const empresas = construirEmpresas(contexto);
  const periodos = construirPeriodos(contexto);
  const cuentas = construirCuentas(contexto);
  const terceros = construirTerceros(contexto);
  const metodosPago = construirMetodosPago(contexto);
  const secuenciasNcf = construirSecuenciasNcf(contexto);
  const asientosConstruidos = construirAsientos(contexto);
  const documentosConstruidos = construirDocumentos(contexto);
  const bancos = construirBancos(contexto);
  const inventario = construirInventario(contexto);
  const activos = construirActivos(contexto);
  const empleados = construirEmpleados(contexto);
  const empresaUsuarios = construirEmpresaUsuarios(contexto, usuarios);

  return {
    usuarios,
    empresas,
    empresaUsuarios,
    periodos,
    cuentas,
    terceros,
    metodosPago,
    secuenciasNcf,
    asientos: asientosConstruidos.asientos,
    asientoLineas: asientosConstruidos.lineas,
    asientosEstados: asientosConstruidos.estados,
    asientosRevertidos: asientosConstruidos.revertidos,
    documentos: documentosConstruidos.documentos,
    documentoPagos: documentosConstruidos.pagos,
    cuentasBancarias: bancos.cuentas,
    movimientosBancarios: bancos.movimientos,
    articulos: inventario.articulos,
    movimientosInventario: inventario.movimientos,
    activos,
    empleados,
    advertencias: contexto.advertencias,
  };
}

// ---------------------------------------------------------------------------
// Supabase: lectura de existentes, perfiles y escritura idempotente
// ---------------------------------------------------------------------------

async function leerTodas(
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
    if (error) {
      throw new Error(`No se pudo leer ${tabla}: ${error.message}`);
    }
    const lote = (data ?? []) as unknown as Fila[];
    filas.push(...lote);
    if (lote.length < tamano) break;
  }

  return filas;
}

async function cargarExistentes(
  cliente: SupabaseClient,
): Promise<MapasExistentes> {
  const mapas = mapasVacios();

  const [
    empresas,
    cuentas,
    terceros,
    periodos,
    metodos,
    secuencias,
    asientos,
    documentos,
  ] = await Promise.all([
    leerTodas(cliente, "empresas", "id, rnc_normalizado, nombre_comercial"),
    leerTodas(cliente, "cuentas", "id, empresa_id, codigo"),
    leerTodas(cliente, "terceros", "id, empresa_id, rnc_normalizado, nombre"),
    leerTodas(cliente, "periodos_contables", "id, empresa_id, nombre"),
    leerTodas(cliente, "metodos_pago", "id, empresa_id, nombre"),
    leerTodas(
      cliente,
      "secuencias_ncf",
      "id, empresa_id, tipo_comprobante, prefijo, numero_inicial",
    ),
    leerTodas(cliente, "asientos", "id, empresa_id, numero"),
    leerTodas(cliente, "documentos_financieros", "id, empresa_id, numero"),
  ]);

  for (const fila of empresas) {
    const id = texto(fila.id);
    const rnc = texto(fila.rnc_normalizado);
    const nombre = texto(fila.nombre_comercial);
    mapas.empresas.set(claveEmpresa(rnc, nombre), id);
  }
  for (const fila of cuentas) {
    mapas.cuentas.set(
      `${texto(fila.empresa_id)}|${texto(fila.codigo)}`,
      texto(fila.id),
    );
  }
  for (const fila of terceros) {
    const rnc = texto(fila.rnc_normalizado);
    const clave = `${texto(fila.empresa_id)}|${
      rnc !== ""
        ? `rnc:${rnc}`
        : `nombre:${normalizarNombre(texto(fila.nombre))}`
    }`;
    mapas.terceros.set(clave, texto(fila.id));
  }
  for (const fila of periodos) {
    mapas.periodos.set(
      `${texto(fila.empresa_id)}|${texto(fila.nombre)}`,
      texto(fila.id),
    );
  }
  for (const fila of metodos) {
    mapas.metodosPago.set(
      `${texto(fila.empresa_id)}|${normalizarNombre(texto(fila.nombre))}`,
      texto(fila.id),
    );
  }
  for (const fila of secuencias) {
    mapas.secuencias.set(
      `${texto(fila.empresa_id)}|${texto(fila.tipo_comprobante)}|${texto(fila.prefijo)}|${texto(fila.numero_inicial)}`,
      texto(fila.id),
    );
  }
  for (const fila of asientos) {
    mapas.asientos.set(
      `${texto(fila.empresa_id)}|${texto(fila.numero)}`,
      texto(fila.id),
    );
  }
  for (const fila of documentos) {
    mapas.documentos.set(
      `${texto(fila.empresa_id)}|${texto(fila.numero)}`,
      texto(fila.id),
    );
  }

  return mapas;
}

async function insertarLote(
  cliente: SupabaseClient,
  tabla: string,
  filas: FilaSalida[],
  conflicto = "id",
): Promise<void> {
  for (let desde = 0; desde < filas.length; desde += TAMANO_LOTE) {
    const lote = filas.slice(desde, desde + TAMANO_LOTE);
    if (lote.length === 0) continue;
    const { error } = await cliente
      .from(tabla)
      .upsert(lote, { onConflict: conflicto, ignoreDuplicates: true });
    if (error) {
      throw new Error(`Fallo al escribir ${tabla}: ${error.message}`);
    }
  }
}

async function leerPerfiles(
  cliente: SupabaseClient,
): Promise<Map<string, string>> {
  const perfiles = new Map<string, string>();
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await cliente
      .from("perfiles")
      .select("user_id, email")
      .range(desde, desde + 999);
    if (error)
      throw new Error(`No se pudieron leer los perfiles: ${error.message}`);
    const lote = (data ?? []) as Fila[];
    for (const fila of lote) {
      perfiles.set(texto(fila.email).toLowerCase(), texto(fila.user_id));
    }
    if (lote.length < 1000) break;
  }
  return perfiles;
}

async function listarUsuariosAuth(
  cliente: SupabaseClient,
): Promise<Map<string, string>> {
  const usuarios = new Map<string, string>();

  for (let pagina = 1; ; pagina += 1) {
    const { data, error } = await cliente.auth.admin.listUsers({
      page: pagina,
      perPage: 1000,
    });
    if (error)
      throw new Error(
        `No se pudieron listar usuarios de Auth: ${error.message}`,
      );
    for (const usuario of data.users) {
      if (usuario.email) {
        usuarios.set(usuario.email.toLowerCase(), usuario.id);
      }
    }
    if (data.users.length < 1000) break;
  }

  return usuarios;
}

async function asegurarUsuarios(
  cliente: SupabaseClient,
  usuarios: ConfigUsuario[],
): Promise<Map<string, string>> {
  const auth = await listarUsuariosAuth(cliente);
  const perfiles = await leerPerfiles(cliente);
  const resultado = new Map<string, string>();

  for (const usuario of usuarios) {
    const correo = usuario.email.toLowerCase();
    let userId = auth.get(correo);

    if (userId === undefined) {
      const { data, error } = await cliente.auth.admin.createUser({
        email: usuario.email,
        email_confirm: true,
        password: randomBytes(24).toString("base64url"),
      });
      if (error || !data.user) {
        throw new Error(
          `No se pudo pre-aprovisionar ${usuario.email}: ${error?.message ?? "sin usuario"}`,
        );
      }
      userId = data.user.id;
      auth.set(correo, userId);
      process.stdout.write(`  + usuario Auth ${usuario.email}\n`);
    } else {
      process.stdout.write(`  = usuario Auth existente ${usuario.email}\n`);
    }

    resultado.set(correo, userId);

    if (perfiles.has(correo)) {
      process.stdout.write(`  = perfil existente ${usuario.email}\n`);
      continue;
    }

    const { error } = await cliente.from("perfiles").insert({
      user_id: userId,
      email: usuario.email,
      nombre: usuario.nombre,
      rol_global: usuario.rol_global,
      debe_definir_password: true,
      activo: true,
    });
    if (error) {
      throw new Error(
        `No se pudo crear el perfil de ${usuario.email}: ${error.message}`,
      );
    }
    process.stdout.write(
      `  + perfil ${usuario.email} (debe_definir_password=true)\n`,
    );
  }

  return resultado;
}

async function ejecutarPlan(
  cliente: SupabaseClient,
  plan: PlanMigracion,
): Promise<void> {
  process.stdout.write("\nUsuarios y perfiles\n");
  const usuarios = await asegurarUsuarios(cliente, plan.usuarios);

  const pasos: {
    nombre: string;
    filas: FilaSalida[];
    conflicto?: string;
  }[] = [
    { nombre: "empresas", filas: plan.empresas },
    { nombre: "periodos_contables", filas: plan.periodos },
    { nombre: "cuentas", filas: plan.cuentas },
    { nombre: "terceros", filas: plan.terceros },
    { nombre: "metodos_pago", filas: plan.metodosPago },
    { nombre: "secuencias_ncf", filas: plan.secuenciasNcf },
    { nombre: "asientos", filas: plan.asientos },
    { nombre: "asiento_lineas", filas: plan.asientoLineas },
    { nombre: "documentos_financieros", filas: plan.documentos },
    { nombre: "documento_pagos", filas: plan.documentoPagos },
    { nombre: "cuentas_bancarias", filas: plan.cuentasBancarias },
    { nombre: "movimientos_bancarios", filas: plan.movimientosBancarios },
    { nombre: "articulos_inventario", filas: plan.articulos },
    { nombre: "movimientos_inventario", filas: plan.movimientosInventario },
    { nombre: "activos_fijos", filas: plan.activos },
    { nombre: "empleados", filas: plan.empleados },
  ];

  for (const paso of pasos) {
    await insertarLote(cliente, paso.nombre, paso.filas);
    process.stdout.write(`  → ${paso.nombre}: ${paso.filas.length} filas\n`);
  }

  const gruposEstado = new Map<string, string[]>();
  for (const asiento of plan.asientosEstados) {
    if (asiento.estado === "draft") continue;
    const actuales = gruposEstado.get(asiento.estado) ?? [];
    actuales.push(asiento.id);
    gruposEstado.set(asiento.estado, actuales);
  }
  for (const [estado, ids] of gruposEstado) {
    for (let desde = 0; desde < ids.length; desde += TAMANO_LOTE) {
      const lote = ids.slice(desde, desde + TAMANO_LOTE);
      const { error } = await cliente
        .from("asientos")
        .update({
          estado,
          contabilizado_en: new Date().toISOString(),
        })
        .in("id", lote)
        .eq("estado", "draft");
      if (error) {
        throw new Error(
          `No se pudo contabilizar el lote de asientos ${estado}: ${error.message}`,
        );
      }
    }
    process.stdout.write(`  → asientos ${estado}: ${ids.length} filas\n`);
  }

  if (plan.asientosRevertidos.length > 0) {
    process.stdout.write("\nEnlazando asientos revertidos\n");
    for (const vinculo of plan.asientosRevertidos) {
      const { error } = await cliente
        .from("asientos")
        .update({ revertido_por: vinculo.revertidoPor })
        .eq("id", vinculo.asientoId);
      if (error) {
        throw new Error(
          `No se pudo enlazar el reverso del asiento ${vinculo.asientoId}: ${error.message}`,
        );
      }
    }
    process.stdout.write(`  → ${plan.asientosRevertidos.length} vínculos\n`);
  }

  process.stdout.write("\nAsignaciones usuario ↔ empresa\n");
  const idsUsuarios = [...usuarios.values()];
  const yaTienenPrincipal = new Set<string>();

  if (idsUsuarios.length > 0) {
    const { data: principales, error: errorPrincipales } = await cliente
      .from("empresa_usuarios")
      .select("user_id")
      .in("user_id", idsUsuarios)
      .eq("es_principal", true);
    if (errorPrincipales) {
      throw new Error(
        `No se pudieron leer asignaciones existentes: ${errorPrincipales.message}`,
      );
    }
    for (const fila of (principales ?? []) as Fila[]) {
      yaTienenPrincipal.add(texto(fila.user_id));
    }
  }

  const filasEmpresaUsuarios = plan.empresaUsuarios.map((asignacion) => {
    const userId = usuarios.get(asignacion.email.toLowerCase());
    if (userId === undefined) {
      throw new Error(`Usuario sin ID de Auth: ${asignacion.email}`);
    }
    const esPrincipal =
      asignacion.esPrincipal && !yaTienenPrincipal.has(userId);
    if (esPrincipal) yaTienenPrincipal.add(userId);
    return {
      user_id: userId,
      empresa_id: asignacion.empresaId,
      rol: asignacion.rol,
      es_principal: esPrincipal,
    };
  });

  await insertarLote(
    cliente,
    "empresa_usuarios",
    filasEmpresaUsuarios,
    "user_id,empresa_id",
  );
  process.stdout.write(
    `  → empresa_usuarios: ${filasEmpresaUsuarios.length} filas\n`,
  );
}

// ---------------------------------------------------------------------------
// Resumen y entrada principal
// ---------------------------------------------------------------------------

function resumenPlan(plan: PlanMigracion): string[] {
  const pares: [string, number][] = [
    ["perfiles (config)", plan.usuarios.length],
    ["empresas", plan.empresas.length],
    ["empresa_usuarios", plan.empresaUsuarios.length],
    ["periodos_contables", plan.periodos.length],
    ["cuentas", plan.cuentas.length],
    ["terceros", plan.terceros.length],
    ["metodos_pago", plan.metodosPago.length],
    ["secuencias_ncf", plan.secuenciasNcf.length],
    ["asientos", plan.asientos.length],
    ["asiento_lineas", plan.asientoLineas.length],
    ["documentos_financieros", plan.documentos.length],
    ["documento_pagos", plan.documentoPagos.length],
    ["cuentas_bancarias", plan.cuentasBancarias.length],
    ["movimientos_bancarios", plan.movimientosBancarios.length],
    ["articulos_inventario", plan.articulos.length],
    ["movimientos_inventario", plan.movimientosInventario.length],
    ["activos_fijos", plan.activos.length],
    ["empleados", plan.empleados.length],
  ];

  return pares.map(
    ([nombre, total]) =>
      `  ${nombre.padEnd(24, " ")} ${String(total).padStart(6, " ")}`,
  );
}

async function principal(): Promise<void> {
  const opciones = parsearArgumentos(process.argv.slice(2));
  const lector = new LectorSqlite(opciones.sqlite);

  try {
    process.stdout.write(
      `Modo: ${opciones.dryRun ? "dry-run (sin escrituras)" : "migración real"}\n`,
    );
    process.stdout.write(`SQLite: ${opciones.sqlite}\n`);

    const usuarios: ConfigUsuario[] =
      opciones.usuarios === null
        ? []
        : parsearConfigUsuarios(
            JSON.parse(fs.readFileSync(opciones.usuarios, "utf8")) as unknown,
          ).usuarios;
    if (usuarios.length === 0) {
      process.stdout.write(
        "Aviso: no se indicó archivo de usuarios; no se pre-aprovisionarán cuentas.\n",
      );
    }

    if (opciones.dryRun) {
      const plan = construirPlan(lector, usuarios, mapasVacios());
      process.stdout.write("\nResumen por tabla (dry-run)\n");
      process.stdout.write(`${resumenPlan(plan).join("\n")}\n`);
      if (plan.advertencias.length > 0) {
        process.stdout.write("\nAdvertencias\n");
        for (const advertencia of plan.advertencias) {
          process.stdout.write(`  · ${advertencia}\n`);
        }
      }
      process.stdout.write(
        "\nCuadre validado: todos los asientos contabilizados cumplen partida doble.\n",
      );
      return;
    }

    cargarEnvLocal();
    const cliente = crearClienteSupabase();
    process.stdout.write("Leyendo datos existentes en Supabase…\n");
    const existentes = await cargarExistentes(cliente);
    const plan = construirPlan(lector, usuarios, existentes);

    process.stdout.write("\nResumen por tabla\n");
    process.stdout.write(`${resumenPlan(plan).join("\n")}\n`);
    if (plan.advertencias.length > 0) {
      process.stdout.write("\nAdvertencias\n");
      for (const advertencia of plan.advertencias) {
        process.stdout.write(`  · ${advertencia}\n`);
      }
    }

    await ejecutarPlan(cliente, plan);
    process.stdout.write("\nMigración completada sin correos automáticos.\n");
  } finally {
    lector.cerrar();
  }
}

principal().catch((error: unknown) => {
  const mensaje = error instanceof Error ? error.message : String(error);
  console.error(`\nMigración abortada: ${mensaje}`);
  process.exitCode = 1;
});
