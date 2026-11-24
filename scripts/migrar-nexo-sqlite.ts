/**
 * Migrador oficial para bases SQLite de Nexo Contable (esquema inglés `companies`,
 * `chart_accounts`, `journal_entries`, `financial_documents`, etc.) hacia
 * Supabase Multi-Empresa (esquema español `empresas`, `cuentas`, `asientos`,
 * `documentos_financieros`, etc.).
 *
 * Uso:
 *   pnpm exec tsx scripts/migrar-nexo-sqlite.ts \
 *     --sqlite work/nexo-contable.sqlite \
 *     --usuarios work/usuarios-iniciales.json \
 *     [--dry-run]
 *
 * Reglas:
 * - Solo lee `.env.local` y `work/*` (nunca hardcodea credenciales ni clientes).
 * - Pre-aprovisiona usuarios en Supabase Auth con `email_confirm: true` (CERO correos).
 * - Preserva cuentas ya existentes (ej. `debe_definir_password = false`).
 * - Idempotente por UUID v5 determinista derivado de cada ID de SQLite.
 * - Sincroniza `secuencias_asientos` para que nuevos asientos no colisionen.
 */

import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import {
  centavosADecimal,
  normalizarRnc,
  parsearConfigUsuarios,
  uuidDeterminista,
  validarPartidaDoble,
} from "./lib/migracion-utils";

type Fila = Record<string, unknown>;

const LOTE = 200;

function log(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

function str(v: unknown, def = ""): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  return def;
}

function strNull(v: unknown): string | null {
  const s = str(v).trim();
  return s === "" ? null : s;
}

function num(v: unknown, def = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return def;
}

function bool(v: unknown, def = false): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number" || typeof v === "bigint") return Number(v) !== 0;
  if (typeof v === "string") {
    const l = v.trim().toLowerCase();
    if (l === "1" || l === "true") return true;
    if (l === "0" || l === "false") return false;
  }
  return def;
}

function cents(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(Math.round(v));
  if (typeof v === "string" && v.trim() !== "") {
    return BigInt(Math.round(Number(v)));
  }
  return 0n;
}

function jsonParseSafe(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  if (typeof v === "string" && v.trim() !== "") {
    try {
      const parsed: unknown = JSON.parse(v);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function cargarEnvLocal(): Record<string, string> {
  const ruta = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(ruta)) {
    throw new Error("No existe .env.local en la raíz del proyecto.");
  }
  const env: Record<string, string> = {};
  for (const linea of fs.readFileSync(ruta, "utf8").split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;
    const eq = limpia.indexOf("=");
    if (eq <= 0) continue;
    const k = limpia.slice(0, eq).trim();
    const val = limpia
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    env[k] = val;
  }
  return env;
}

function parsearArgs(argv: string[]) {
  let sqlite = path.resolve(process.cwd(), "work", "nexo-contable.sqlite");
  let usuarios = path.resolve(process.cwd(), "work", "usuarios-iniciales.json");
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dry-run") {
      dryRun = true;
    } else if (a === "--sqlite" && argv[i + 1]) {
      sqlite = path.resolve(process.cwd(), argv[i + 1] ?? "");
      i += 1;
    } else if (a === "--usuarios" && argv[i + 1]) {
      usuarios = path.resolve(process.cwd(), argv[i + 1] ?? "");
      i += 1;
    }
  }
  return { sqlite, usuarios, dryRun };
}

async function upsertLotes(
  supabase: SupabaseClient,
  tabla: string,
  filas: Fila[],
  onConflict: string,
): Promise<void> {
  for (let i = 0; i < filas.length; i += LOTE) {
    const lote = filas.slice(i, i + LOTE);
    const { error } = await supabase
      .from(tabla)
      .upsert(lote, { onConflict, ignoreDuplicates: false });
    if (error) {
      throw new Error(
        `Error en upsert de ${tabla} (lote ${i}..${i + lote.length}): ${error.message}`,
      );
    }
  }
}

async function insertarLotesIgnorando(
  supabase: SupabaseClient,
  tabla: string,
  filas: Fila[],
  onConflict: string,
): Promise<void> {
  for (let i = 0; i < filas.length; i += LOTE) {
    const lote = filas.slice(i, i + LOTE);
    const { error } = await supabase
      .from(tabla)
      .upsert(lote, { onConflict, ignoreDuplicates: true });
    if (error) {
      throw new Error(
        `Error en insert de ${tabla} (lote ${i}..${i + lote.length}): ${error.message}`,
      );
    }
  }
}

function ordenarCuentasTopologicamente(cuentas: Fila[]): Fila[] {
  const porId = new Map<string, Fila>();
  for (const c of cuentas) porId.set(str(c.id), c);

  const visitados = new Set<string>();
  const ordenadas: Fila[] = [];

  function visitar(c: Fila): void {
    const id = str(c.id);
    if (visitados.has(id)) return;
    const padreId = strNull(c.parent_id);
    if (padreId && porId.has(padreId)) {
      const padre = porId.get(padreId);
      if (padre) visitar(padre);
    }
    visitados.add(id);
    ordenadas.push(c);
  }

  for (const c of cuentas) visitar(c);
  return ordenadas;
}

function mapTipoRegla(taxType: string): string {
  const l = taxType.trim().toLowerCase();
  if (l.includes("retencion") && l.includes("itbis")) return "retencion_itbis";
  if (l.includes("retencion") && l.includes("isr")) return "retencion_isr";
  if (l.includes("itbis")) return "itbis";
  if (l.includes("isr")) return "isr";
  return "otro";
}

function mapTipoMovBanco(txType: string, direction: string): string {
  const t = txType.trim().toLowerCase();
  if (
    t === "deposit" ||
    t === "withdrawal" ||
    t === "transfer" ||
    t === "fee" ||
    t === "interest"
  ) {
    return t;
  }
  return direction.trim().toLowerCase() === "in" ? "deposit" : "withdrawal";
}

async function main(): Promise<void> {
  const args = parsearArgs(process.argv.slice(2));
  if (!fs.existsSync(args.sqlite)) {
    throw new Error(`No existe SQLite: ${args.sqlite}`);
  }

  const db = new DatabaseSync(args.sqlite, { readOnly: true });
  const leer = (tabla: string): Fila[] => {
    const existe = db
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
      )
      .get(tabla);
    if (!existe) return [];
    return db.prepare(`SELECT * FROM "${tabla}"`).all() as Fila[];
  };

  const companies = leer("companies");
  const sqliteUsers = leer("users");
  const periods = leer("accounting_periods");
  const accounts = ordenarCuentasTopologicamente(leer("chart_accounts"));
  const parties = leer("parties");
  const paymentMethods = leer("payment_methods");
  const fiscalSettings = leer("fiscal_settings");
  const fiscalRules = leer("fiscal_rules");
  const taxObligations = leer("tax_obligations");
  const journalEntries = leer("journal_entries");
  const journalLines = leer("journal_lines");
  const documents = leer("financial_documents");
  const payments = leer("document_payments");
  const bankAccounts = leer("bank_accounts");
  const bankTx = leer("bank_transactions");
  const inventoryItems = leer("inventory_items");
  const auditRows = leer("audit_log");

  // Validar partida doble en memoria ANTES de escribir nada
  const lineasPorAsiento = new Map<string, Fila[]>();
  for (const l of journalLines) {
    const eid = str(l.entry_id);
    const arr = lineasPorAsiento.get(eid) ?? [];
    arr.push(l);
    lineasPorAsiento.set(eid, arr);
  }

  let totalDebito = 0n;
  let totalCredito = 0n;
  for (const e of journalEntries) {
    const eid = str(e.id);
    const ls = lineasPorAsiento.get(eid) ?? [];
    const check = validarPartidaDoble(
      ls.map((l) => ({
        debitoCents: cents(l.debit_cents),
        creditoCents: cents(l.credit_cents),
      })),
    );
    if (!check.valido) {
      throw new Error(
        `Asiento ${str(e.entry_number)} descuadrado: ${check.errores.join("; ")}`,
      );
    }
    totalDebito += check.totalDebitoCents;
    totalCredito += check.totalCreditoCents;
  }

  const configUsuarios = fs.existsSync(args.usuarios)
    ? parsearConfigUsuarios(JSON.parse(fs.readFileSync(args.usuarios, "utf8")))
    : { usuarios: [] };

  log(
    `=== Plan de migración (${args.dryRun ? "DRY-RUN" : "ESCRITURA REAL"}) ===`,
  );
  log(`Empresas: ${companies.length}`);
  log(
    `Usuarios SQLite: ${sqliteUsers.length} · Usuarios JSON: ${configUsuarios.usuarios.length}`,
  );
  log(`Períodos: ${periods.length} · Cuentas: ${accounts.length}`);
  log(
    `Asientos: ${journalEntries.length} · Líneas: ${journalLines.length} (Débito=${centavosADecimal(totalDebito)} == Crédito=${centavosADecimal(totalCredito)})`,
  );
  log(
    `Terceros: ${parties.length} · Métodos pago: ${paymentMethods.length} · Documentos: ${documents.length} · Pagos: ${payments.length}`,
  );
  log(
    `Bancos: ${bankAccounts.length} · Mov. banco: ${bankTx.length} · Inventario: ${inventoryItems.length} · Auditoría: ${auditRows.length}`,
  );

  if (args.dryRun) {
    log("DRY-RUN OK — todo cuadra y no se escribió nada en Supabase.");
    db.close();
    return;
  }

  const env = cargarEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local",
    );
  }
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Mapas deterministas SQLite ID -> UUID
  const idEmpresa = (oldId: unknown) => uuidDeterminista("empresa", str(oldId));
  const idPeriodo = (oldId: unknown) => uuidDeterminista("periodo", str(oldId));
  const idCuenta = (oldId: unknown) => uuidDeterminista("cuenta", str(oldId));
  const idTercero = (oldId: unknown) => uuidDeterminista("tercero", str(oldId));
  const idMetodo = (oldId: unknown) => uuidDeterminista("metodo", str(oldId));
  const idAsiento = (oldId: unknown) => uuidDeterminista("asiento", str(oldId));
  const idLinea = (oldId: unknown) => uuidDeterminista("linea", str(oldId));
  const idDoc = (oldId: unknown) => uuidDeterminista("documento", str(oldId));
  const idPago = (oldId: unknown) => uuidDeterminista("pago", str(oldId));
  const idBanco = (oldId: unknown) => uuidDeterminista("banco", str(oldId));
  const idMovBanco = (oldId: unknown) =>
    uuidDeterminista("mov_banco", str(oldId));
  const idArticulo = (oldId: unknown) =>
    uuidDeterminista("articulo", str(oldId));
  const idRegla = (oldId: unknown) => uuidDeterminista("regla", str(oldId));
  const idOblig = (oldId: unknown) =>
    uuidDeterminista("obligacion", str(oldId));

  // 1. Pre-aprovisionar usuarios en Auth (CERO emails) y perfiles
  log("1/12 Sincronizando usuarios Auth y perfiles...");
  const { data: existentesAuth, error: errAuthList } =
    await supabase.auth.admin.listUsers({ page: 1, perPage: 500 });
  if (errAuthList) throw errAuthList;
  const authPorEmail = new Map<string, string>();
  for (const u of existentesAuth.users) {
    if (u.email) authPorEmail.set(u.email.toLowerCase(), u.id);
  }

  const { data: perfilesActuales } = await supabase
    .from("perfiles")
    .select("user_id, email, debe_definir_password")
    .limit(500);
  const perfilActualPorEmail = new Map<
    string,
    { user_id: string; debe_definir_password: boolean }
  >();
  for (const p of perfilesActuales ?? []) {
    perfilActualPorEmail.set(str(p.email).toLowerCase(), {
      user_id: str(p.user_id),
      debe_definir_password: Boolean(p.debe_definir_password),
    });
  }

  const sqliteUserIdToAuthId = new Map<string, string>();
  const emailPorSqliteUserId = new Map<string, string>();
  for (const su of sqliteUsers) {
    emailPorSqliteUserId.set(str(su.id), str(su.email).trim().toLowerCase());
  }

  const usuariosFinales = new Map<
    string,
    {
      email: string;
      nombre: string;
      rol_global: "admin_global" | "usuario";
      activo: boolean;
      debe_definir_password: boolean;
    }
  >();

  for (const su of sqliteUsers) {
    const email = str(su.email).trim().toLowerCase();
    if (!email) continue;
    usuariosFinales.set(email, {
      email,
      nombre: str(su.display_name, email.split("@")[0] ?? "Usuario"),
      rol_global: "usuario",
      activo: bool(su.active, true),
      debe_definir_password: true,
    });
  }

  for (const cu of configUsuarios.usuarios) {
    const email = cu.email.trim().toLowerCase();
    const previo = perfilActualPorEmail.get(email);
    usuariosFinales.set(email, {
      email,
      nombre: cu.nombre,
      rol_global: cu.rol_global,
      activo: true,
      // Si ya definió contraseña (ej. Waldy), conservar false
      debe_definir_password:
        previo !== undefined ? previo.debe_definir_password : true,
    });
  }

  for (const u of usuariosFinales.values()) {
    let uid = authPorEmail.get(u.email);
    if (!uid) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: randomBytes(24).toString("base64url"),
        email_confirm: true,
        user_metadata: { nombre: u.nombre },
      });
      if (error || !data.user) {
        throw new Error(
          `Error creando Auth para usuario: ${error?.message ?? "sin user"}`,
        );
      }
      uid = data.user.id;
      authPorEmail.set(u.email, uid);
    }

    const { error: errPerf } = await supabase.from("perfiles").upsert(
      {
        user_id: uid,
        email: u.email,
        nombre: u.nombre,
        rol_global: u.rol_global,
        debe_definir_password: u.debe_definir_password,
        activo: u.activo,
      },
      { onConflict: "user_id" },
    );
    if (errPerf) {
      throw new Error(`Error en upsert perfil: ${errPerf.message}`);
    }
  }

  for (const [oldUid, email] of emailPorSqliteUserId.entries()) {
    const authId = authPorEmail.get(email);
    if (authId) sqliteUserIdToAuthId.set(oldUid, authId);
  }
  const mapActor = (oldUid: unknown): string | null => {
    const k = strNull(oldUid);
    if (!k) return null;
    return sqliteUserIdToAuthId.get(k) ?? null;
  };

  // 2. Empresas (priorizar activas si una copia inactiva comparte el mismo RNC normalizado)
  log("2/12 Migrando empresas...");
  const ordenEmpresas = [...companies].sort((a, b) => {
    const aAct = str(a.status) === "inactive" ? 1 : 0;
    const bAct = str(b.status) === "inactive" ? 1 : 0;
    return aAct - bAct;
  });
  const rncsVistos = new Set<string>();
  const empresasOut: Fila[] = ordenEmpresas.map((c) => {
    const rncOrig = str(c.rnc).trim();
    const rncNormOrig = normalizarRnc(rncOrig);
    const duplicado = rncNormOrig !== "" && rncsVistos.has(rncNormOrig);
    if (rncNormOrig !== "") rncsVistos.add(rncNormOrig);
    return {
      id: idEmpresa(c.id),
      nombre_comercial: str(c.business_name).trim(),
      razon_social: str(c.legal_name, str(c.business_name)).trim(),
      rnc: duplicado ? "" : rncOrig,
      rnc_normalizado: duplicado ? "" : rncNormOrig,
      tipo_empresa: str(c.company_type).trim(),
      direccion: str(c.address).trim(),
      telefono: str(c.phone).trim(),
      correo: str(c.email).trim(),
      representante_legal: str(c.legal_representative).trim(),
      actividad_economica: str(c.economic_activity).trim(),
      fecha_inicio: strNull(c.start_date),
      regimen_fiscal: str(c.tax_regime, "ordinario").trim() || "ordinario",
      moneda_funcional: str(c.functional_currency, "DOP").trim() || "DOP",
      periodo_fiscal: str(c.fiscal_period, "01-12").trim() || "01-12",
      estado: str(c.status) === "inactive" ? "inactive" : "active",
    };
  });
  await upsertLotes(supabase, "empresas", empresasOut, "id");

  // 3. Asignaciones empresa_usuarios (contadores + empresa principal para todos)
  log("3/12 Sincronizando empresa_usuarios...");
  const empresaPorClave = new Map<string, string>();
  const primeraEmpresaActiva = empresasOut.find((e) => e.estado === "active");
  for (const e of empresasOut) {
    const eid = str(e.id);
    if (str(e.rnc_normalizado))
      empresaPorClave.set(str(e.rnc_normalizado), eid);
    empresaPorClave.set(str(e.nombre_comercial).toLowerCase(), eid);
  }

  const asignaciones: Fila[] = [];
  for (const cu of configUsuarios.usuarios) {
    const uid = authPorEmail.get(cu.email.trim().toLowerCase());
    if (!uid) continue;
    if (cu.rol_global === "admin_global") {
      if (primeraEmpresaActiva) {
        asignaciones.push({
          user_id: uid,
          empresa_id: str(primeraEmpresaActiva.id),
          rol: "admin_empresa",
          es_principal: true,
        });
      }
      continue;
    }
    const lista = cu.empresas ?? [];
    for (let idx = 0; idx < lista.length; idx += 1) {
      const asig = lista[idx];
      if (!asig) continue;
      const eid =
        empresaPorClave.get(normalizarRnc(asig.rnc_o_nombre)) ??
        empresaPorClave.get(asig.rnc_o_nombre.trim().toLowerCase());
      if (!eid) continue;
      asignaciones.push({
        user_id: uid,
        empresa_id: eid,
        rol: asig.rol,
        es_principal: Boolean(asig.es_principal ?? idx === 0),
      });
    }
  }
  await insertarLotesIgnorando(
    supabase,
    "empresa_usuarios",
    asignaciones,
    "user_id,empresa_id",
  );

  // 4. Períodos contables
  log("4/12 Migrando periodos_contables...");
  const periodosOut: Fila[] = periods.map((p) => ({
    id: idPeriodo(p.id),
    empresa_id: idEmpresa(p.company_id),
    nombre: str(p.name).trim(),
    fecha_inicio: str(p.start_date).slice(0, 10),
    fecha_fin: str(p.end_date).slice(0, 10),
    estado: str(p.status) === "closed" ? "closed" : "open",
    cerrado_en: strNull(p.closed_at),
  }));
  await upsertLotes(supabase, "periodos_contables", periodosOut, "id");

  // 5. Catálogo de cuentas (orden padre -> hijo)
  log("5/12 Migrando cuentas (1,944 registros)...");
  const cuentasOut: Fila[] = accounts.map((a) => ({
    id: idCuenta(a.id),
    empresa_id: idEmpresa(a.company_id),
    codigo: str(a.code).trim(),
    nombre: str(a.name).trim(),
    padre_id: strNull(a.parent_id) ? idCuenta(a.parent_id) : null,
    clasificacion: str(a.classification),
    naturaleza: str(a.normal_balance),
    nivel: num(a.level, 1),
    es_agrupacion: bool(a.is_header, false),
    activa: bool(a.active, true),
    es_equivalente_efectivo: bool(a.is_cash_equivalent, false),
    categoria_flujo_efectivo: str(a.cash_flow_category, "operating"),
  }));
  await upsertLotes(supabase, "cuentas", cuentasOut, "id");

  // 6. Terceros
  log("6/12 Migrando terceros...");
  const tercerosOut: Fila[] = parties.map((p) => {
    const rnc = str(p.rnc).trim();
    return {
      id: idTercero(p.id),
      empresa_id: idEmpresa(p.company_id),
      tipo: str(p.party_type, "both"),
      nombre: str(p.name).trim(),
      rnc,
      rnc_normalizado: normalizarRnc(rnc),
      correo: str(p.email).trim(),
      telefono: str(p.phone).trim(),
      direccion: "",
      cuenta_por_pagar_id: strNull(p.payable_account_id)
        ? idCuenta(p.payable_account_id)
        : null,
      cuenta_por_cobrar_id: strNull(p.receivable_account_id)
        ? idCuenta(p.receivable_account_id)
        : null,
      activo: bool(p.active, true),
    };
  });
  await upsertLotes(supabase, "terceros", tercerosOut, "id");

  // 7. Métodos de pago + configuración/reglas/obligaciones fiscales
  log("7/12 Migrando métodos de pago y parámetros fiscales...");
  const metodosOut: Fila[] = paymentMethods.map((m) => ({
    id: idMetodo(m.id),
    empresa_id: idEmpresa(m.company_id),
    nombre: str(m.name).trim(),
    cuenta_id: idCuenta(m.account_id),
    deja_cxp_proveedor: bool(m.leaves_supplier_payable, false),
    activo: bool(m.active, true),
  }));
  await upsertLotes(supabase, "metodos_pago", metodosOut, "id");

  const configFiscalOut: Fila[] = fiscalSettings.map((fsRow) => ({
    empresa_id: idEmpresa(fsRow.company_id),
    tasa_itbis_bps: 1800,
    retencion_isr_servicios_bps: 1000,
    retencion_itbis_servicios_bps: 3000,
  }));
  await upsertLotes(
    supabase,
    "configuracion_fiscal",
    configFiscalOut,
    "empresa_id",
  );

  const reglasOut: Fila[] = fiscalRules.map((r) => ({
    id: idRegla(r.id),
    empresa_id: idEmpresa(r.company_id),
    codigo: str(r.rule_code).trim(),
    nombre: str(r.description, str(r.rule_code)).trim(),
    tipo: mapTipoRegla(str(r.tax_type)),
    tasa_bps: num(r.rate_bps, 1800),
    activa: bool(r.active, true),
  }));
  await upsertLotes(supabase, "reglas_fiscales", reglasOut, "id");

  const obligOut: Fila[] = taxObligations.map((o) => ({
    id: idOblig(o.id),
    empresa_id: idEmpresa(o.company_id),
    codigo_formulario: str(o.obligation_code).trim(),
    periodo: str(o.period).trim(),
    fecha_limite: str(o.due_date).slice(0, 10),
    estado: str(o.status, "pending"),
    monto_declarado: 0,
    referencia_presentacion: str(o.notes).trim(),
  }));
  await upsertLotes(supabase, "obligaciones_fiscales", obligOut, "id");

  // 8. Asientos y líneas (en 3 fases para respetar triggers diferidos e inmutabilidad)
  log("8/12 Migrando asientos y líneas (689 asientos, 1,825 líneas)...");
  const { data: existentesAsientos } = await supabase
    .from("asientos")
    .select("id, estado")
    .limit(5000);
  const asientoExistente = new Map<string, string>();
  for (const a of existentesAsientos ?? []) {
    asientoExistente.set(str(a.id), str(a.estado));
  }

  const asientosNuevos = journalEntries.filter(
    (e) => !asientoExistente.has(idAsiento(e.id)),
  );

  if (asientosNuevos.length > 0) {
    // 8a. Insertar como draft sin referencias cruzadas
    const borradores: Fila[] = asientosNuevos.map((e) => ({
      id: idAsiento(e.id),
      empresa_id: idEmpresa(e.company_id),
      numero: str(e.entry_number).trim(),
      fecha: str(e.entry_date).slice(0, 10),
      tipo_operacion: str(e.operation_type, "manual").trim() || "manual",
      descripcion: str(e.description).trim() || "Asiento migrado",
      referencia: str(e.reference).trim(),
      estado: "draft",
      reverso_de: null,
      revertido_por: null,
      creado_por: mapActor(e.created_by),
      contabilizado_por: mapActor(e.posted_by),
      contabilizado_en: strNull(e.posted_at),
    }));
    await insertarLotesIgnorando(supabase, "asientos", borradores, "id");

    // 8b. Enlazar reverso_de mientras siguen en draft
    for (const e of asientosNuevos) {
      const revDe = strNull(e.reversal_of);
      if (!revDe) continue;
      const { error } = await supabase
        .from("asientos")
        .update({ reverso_de: idAsiento(revDe) })
        .eq("id", idAsiento(e.id));
      if (error) {
        throw new Error(
          `Error enlazando reverso_de en ${str(e.entry_number)}: ${error.message}`,
        );
      }
    }

    // 8c. Insertar líneas de asientos nuevos
    const idsNuevos = new Set(asientosNuevos.map((e) => str(e.id)));
    const lineasOut: Fila[] = journalLines
      .filter((l) => idsNuevos.has(str(l.entry_id)))
      .map((l) => ({
        id: idLinea(l.id),
        asiento_id: idAsiento(l.entry_id),
        empresa_id: idEmpresa(l.company_id),
        linea: num(l.line_number, 1),
        cuenta_id: idCuenta(l.account_id),
        descripcion: str(l.description).trim(),
        debito: centavosADecimal(cents(l.debit_cents)),
        credito: centavosADecimal(cents(l.credit_cents)),
      }));
    await insertarLotesIgnorando(supabase, "asiento_lineas", lineasOut, "id");

    // 8d. Aplicar estado final + revertido_por
    for (const e of asientosNuevos) {
      const estadoFinal = str(e.status, "posted");
      if (estadoFinal === "draft") continue;
      const revPor = strNull(e.reversed_by);
      const { error } = await supabase
        .from("asientos")
        .update({
          estado: estadoFinal,
          revertido_por: revPor ? idAsiento(revPor) : null,
        })
        .eq("id", idAsiento(e.id));
      if (error) {
        throw new Error(
          `Error finalizando asiento ${str(e.entry_number)} (${estadoFinal}): ${error.message}`,
        );
      }
    }
  }

  // 8e. Sincronizar secuencias_asientos (max JE-YYYY-NNNNN por empresa/año)
  const maxSeq = new Map<
    string,
    { empresa_id: string; anio: number; max: number }
  >();
  for (const e of journalEntries) {
    const m = /^JE-(\d{4})-(\d+)$/.exec(str(e.entry_number).trim());
    if (!m?.[1] || !m[2]) continue;
    const eid = idEmpresa(e.company_id);
    const anio = Number(m[1]);
    const n = Number(m[2]);
    const clave = `${eid}:${anio}`;
    const prev = maxSeq.get(clave);
    if (!prev || n > prev.max) {
      maxSeq.set(clave, { empresa_id: eid, anio, max: n });
    }
  }
  const secOut: Fila[] = Array.from(maxSeq.values()).map((s) => ({
    empresa_id: s.empresa_id,
    anio: s.anio,
    ultimo_numero: s.max,
  }));
  await upsertLotes(supabase, "secuencias_asientos", secOut, "empresa_id,anio");

  // 9. Documentos financieros (primero sin documento_acreditado_id si aplica, aquí todos sin créditos cruzados)
  log("9/12 Migrando documentos_financieros (158 registros)...");
  const docsOut: Fila[] = documents.map((d) => {
    const ncf = str(d.ncf).trim();
    const tipoNcf = ncf.length >= 3 ? ncf.slice(0, 3).toUpperCase() : "";
    return {
      id: idDoc(d.id),
      empresa_id: idEmpresa(d.company_id),
      tipo: str(d.document_type),
      numero: str(d.number).trim(),
      ncf,
      tipo_ncf: tipoNcf,
      tercero_id: idTercero(d.party_id),
      fecha_emision: str(d.issue_date).slice(0, 10),
      fecha_vencimiento: strNull(d.due_date)?.slice(0, 10) ?? null,
      concepto: str(d.concept).trim() || "Documento migrado",
      subtotal: centavosADecimal(cents(d.subtotal_cents)),
      impuesto: centavosADecimal(cents(d.tax_cents)),
      retenciones: centavosADecimal(cents(d.retentions_cents)),
      otros_impuestos: centavosADecimal(cents(d.other_taxes_cents)),
      total: centavosADecimal(cents(d.total_cents)),
      detalles_fiscales: jsonParseSafe(d.tax_details_json),
      cuenta_id: idCuenta(d.account_id),
      cuenta_control_id: idCuenta(d.control_account_id),
      cuenta_impuesto_id: strNull(d.tax_account_id)
        ? idCuenta(d.tax_account_id)
        : null,
      cuenta_retencion_id: strNull(d.retention_account_id)
        ? idCuenta(d.retention_account_id)
        : null,
      documento_acreditado_id: strNull(d.credited_document_id)
        ? idDoc(d.credited_document_id)
        : null,
      estado: str(d.status, "posted"),
      asiento_id: strNull(d.journal_entry_id)
        ? idAsiento(d.journal_entry_id)
        : null,
      creado_por: mapActor(d.created_by),
    };
  });
  await insertarLotesIgnorando(
    supabase,
    "documentos_financieros",
    docsOut,
    "id",
  );

  // 10. Pagos de documentos
  log("10/12 Migrando documento_pagos (405 registros)...");
  const pagosOut: Fila[] = payments.map((p) => ({
    id: idPago(p.id),
    empresa_id: idEmpresa(p.company_id),
    documento_id: idDoc(p.document_id),
    fecha_pago: str(p.payment_date).slice(0, 10),
    monto: centavosADecimal(cents(p.amount_cents)),
    metodo_pago: str(p.payment_method).trim(),
    cuenta_id: idCuenta(p.account_id),
    referencia: str(p.reference).trim(),
    asiento_id: strNull(p.journal_entry_id)
      ? idAsiento(p.journal_entry_id)
      : null,
    estado: str(p.status) === "cancelled" ? "cancelled" : "active",
    cancelado_en: strNull(p.cancelled_at),
    creado_por: mapActor(p.created_by),
  }));
  await insertarLotesIgnorando(supabase, "documento_pagos", pagosOut, "id");

  // 11. Bancos e inventario
  log("11/12 Migrando bancos e inventario...");
  const bancosOut: Fila[] = bankAccounts.map((b) => ({
    id: idBanco(b.id),
    empresa_id: idEmpresa(b.company_id),
    nombre: str(b.name).trim(),
    banco: str(b.bank_name).trim(),
    numero_cuenta: str(b.last_four).trim(),
    moneda: str(b.currency, "DOP").trim() || "DOP",
    cuenta_contable_id: idCuenta(b.chart_account_id),
    saldo_inicial: 0,
    activa: bool(b.active, true),
  }));
  await upsertLotes(supabase, "cuentas_bancarias", bancosOut, "id");

  const movBancoOut: Fila[] = bankTx.map((t) => ({
    id: idMovBanco(t.id),
    empresa_id: idEmpresa(t.company_id),
    cuenta_bancaria_id: idBanco(t.bank_account_id),
    fecha: str(t.transaction_date).slice(0, 10),
    descripcion: str(t.description).trim() || "Movimiento bancario",
    referencia: str(t.reference).trim(),
    tipo: mapTipoMovBanco(str(t.transaction_type), str(t.direction)),
    monto: centavosADecimal(cents(t.amount_cents)),
    conciliado: strNull(t.reconciled_at) !== null,
    asiento_id: strNull(t.journal_entry_id)
      ? idAsiento(t.journal_entry_id)
      : null,
  }));
  await insertarLotesIgnorando(
    supabase,
    "movimientos_bancarios",
    movBancoOut,
    "id",
  );

  const invOut: Fila[] = inventoryItems.map((it) => {
    const qty = num(it.qty_on_hand, 0);
    const valCents = cents(it.value_cents);
    const costoProm =
      qty > 0 ? (Number(valCents) / 100 / qty).toFixed(2) : "0.00";
    return {
      id: idArticulo(it.id),
      empresa_id: idEmpresa(it.company_id),
      sku: str(it.sku).trim(),
      nombre: str(it.name).trim(),
      descripcion: "",
      unidad: str(it.unit, "UNIDAD").trim() || "UNIDAD",
      cantidad_disponible: qty.toFixed(4),
      costo_promedio: costoProm,
      valor_total: centavosADecimal(valCents),
      precio_venta: centavosADecimal(cents(it.sale_price_cents)),
      cuenta_inventario_id: strNull(it.inventory_account_id)
        ? idCuenta(it.inventory_account_id)
        : null,
      cuenta_costo_id: strNull(it.cogs_account_id)
        ? idCuenta(it.cogs_account_id)
        : null,
      cuenta_ingreso_id: strNull(it.income_account_id)
        ? idCuenta(it.income_account_id)
        : null,
      activo: bool(it.active, true),
    };
  });
  await upsertLotes(supabase, "articulos_inventario", invOut, "id");

  // 12. Auditoría histórica (solo si aún no está cargada)
  log("12/12 Migrando auditoría histórica (733 registros)...");
  const { count: audActual } = await supabase
    .from("auditoria")
    .select("id", { count: "exact", head: true });
  if ((audActual ?? 0) === 0 && auditRows.length > 0) {
    const audOut: Fila[] = auditRows.map((r) => ({
      actor_id: mapActor(r.actor_id),
      empresa_id: strNull(r.company_id) ? idEmpresa(r.company_id) : null,
      accion: str(r.action).trim() || "migracion",
      entidad: str(r.entity).trim() || "sistema",
      entidad_id: str(r.entity_id).trim(),
      detalles: jsonParseSafe(r.details),
      creado_en: strNull(r.created_at) ?? new Date().toISOString(),
    }));
    for (let i = 0; i < audOut.length; i += LOTE) {
      const { error } = await supabase
        .from("auditoria")
        .insert(audOut.slice(i, i + LOTE));
      if (error) {
        throw new Error(`Error insertando auditoría: ${error.message}`);
      }
    }
  }

  db.close();
  log("=== MIGRACIÓN COMPLETADA CON ÉXITO ===");
}

main().catch((err) => {
  console.error(
    `migrar-nexo-sqlite: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
