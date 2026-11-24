import {
  BancosVista,
  type CuentaBancariaListado,
  type ImportacionListado,
  type MovimientoListado,
  type SesionListado,
} from "@/components/bancos/bancos-vista";
import { SinEmpresaActiva } from "@/components/comunes/sin-empresa";
import { obtenerContextoApp } from "@/lib/auth/sesion";
import { cargarOpcionesCuentas } from "@/lib/datos/cuentas";
import type { Moneda } from "@/lib/formato";
import {
  UUID_NULO,
  esFecha,
  esUuid,
  fechaOFecha,
  parametroUrl,
} from "@/lib/parametros";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Banco y conciliación · Nexo Contable",
};

interface CuentaBancariaFila {
  id: string;
  nombre: string;
  banco: string;
  numero_cuenta: string;
  moneda: string;
  cuenta_contable_id: string;
  saldo_inicial: number;
  activa: boolean;
}

interface MovimientoFila {
  id: string;
  cuenta_bancaria_id: string;
  fecha: string;
  descripcion: string;
  referencia: string;
  tipo: string;
  monto: number;
  conciliado: boolean;
  sesion_conciliacion_id: string | null;
}

interface ImportacionFila {
  id: string;
  cuenta_bancaria_id: string;
  nombre_archivo: string;
  total_filas: number;
  creado_en: string;
}

interface SesionFila {
  id: string;
  cuenta_bancaria_id: string;
  fecha_corte: string;
  saldo_extracto: number;
  saldo_libros: number;
  diferencia: number;
  estado: string;
  cerrada_en: string | null;
}

export default async function BancosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const contexto = await obtenerContextoApp();
  const empresa = contexto.empresaActiva;

  if (!empresa) {
    return (
      <SinEmpresaActiva descripcion="Selecciona o crea una empresa para administrar sus cuentas bancarias y conciliaciones." />
    );
  }

  const params = await searchParams;
  const cuentaParam = parametroUrl(params, "cuenta");
  const desdeParam = parametroUrl(params, "desde");
  const hastaParam = parametroUrl(params, "hasta");

  const filtroCuenta = esUuid(cuentaParam) ? cuentaParam : "";
  const desde = esFecha(desdeParam) ? desdeParam : "";
  const hasta = esFecha(hastaParam) ? hastaParam : "";

  const supabase = await createClient();
  const moneda: Moneda = empresa.monedaFuncional === "USD" ? "USD" : "DOP";

  const cuentasFilas = await paginarConsulta<CuentaBancariaFila>(
    async (desdeRango, hastaRango) => {
      const { data, error } = await supabase
        .from("cuentas_bancarias")
        .select(
          "id, nombre, banco, numero_cuenta, moneda, cuenta_contable_id, saldo_inicial, activa",
        )
        .eq("empresa_id", empresa.id)
        .order("nombre", { ascending: true })
        .order("id", { ascending: true })
        .range(desdeRango, hastaRango);
      return { data: (data as CuentaBancariaFila[] | null) ?? null, error };
    },
  );

  const idsCuentas = cuentasFilas.map((cuenta) => cuenta.id);
  const idsMovimientos =
    filtroCuenta !== ""
      ? [filtroCuenta]
      : idsCuentas.length > 0
        ? idsCuentas
        : [UUID_NULO];

  const [
    movimientosConsulta,
    importacionesConsulta,
    sesionesFilas,
    opcionesCuentasContables,
  ] = await Promise.all([
    supabase
      .from("movimientos_bancarios")
      .select(
        "id, cuenta_bancaria_id, fecha, descripcion, referencia, tipo, monto, conciliado, sesion_conciliacion_id",
      )
      .eq("empresa_id", empresa.id)
      .in("cuenta_bancaria_id", idsMovimientos)
      .gte("fecha", fechaOFecha(desde, "1900-01-01") ?? "1900-01-01")
      .lte("fecha", fechaOFecha(hasta, "2999-12-31") ?? "2999-12-31")
      .order("fecha", { ascending: false })
      .order("id", { ascending: false })
      .range(0, 999),
    supabase
      .from("importaciones_bancarias")
      .select("id, cuenta_bancaria_id, nombre_archivo, total_filas, creado_en")
      .eq("empresa_id", empresa.id)
      .order("creado_en", { ascending: false })
      .order("id", { ascending: false })
      .range(0, 199),
    paginarConsulta<SesionFila>(async (desdeRango, hastaRango) => {
      const { data, error } = await supabase
        .from("sesiones_conciliacion_bancaria")
        .select(
          "id, cuenta_bancaria_id, fecha_corte, saldo_extracto, saldo_libros, diferencia, estado, cerrada_en",
        )
        .eq("empresa_id", empresa.id)
        .order("fecha_corte", { ascending: false })
        .order("id", { ascending: false })
        .range(desdeRango, hastaRango);
      return { data: (data as SesionFila[] | null) ?? null, error };
    }),
    cargarOpcionesCuentas(supabase, empresa.id),
  ]);

  const cuentas: CuentaBancariaListado[] = cuentasFilas.map((fila) => ({
    id: fila.id,
    nombre: fila.nombre,
    banco: fila.banco,
    numeroCuenta: fila.numero_cuenta,
    moneda: fila.moneda,
    cuentaContableId: fila.cuenta_contable_id,
    saldoInicial: Number(fila.saldo_inicial),
    activa: fila.activa,
  }));

  const movimientosFilas =
    (movimientosConsulta.data as MovimientoFila[] | null) ?? [];
  const movimientos: MovimientoListado[] = movimientosFilas.map((fila) => ({
    id: fila.id,
    cuentaBancariaId: fila.cuenta_bancaria_id,
    fecha: fila.fecha,
    descripcion: fila.descripcion,
    referencia: fila.referencia,
    tipo: fila.tipo,
    monto: Number(fila.monto),
    conciliado: fila.conciliado,
    sesionId: fila.sesion_conciliacion_id,
  }));

  const importacionesFilas =
    (importacionesConsulta.data as ImportacionFila[] | null) ?? [];
  const importaciones: ImportacionListado[] = importacionesFilas.map(
    (fila) => ({
      id: fila.id,
      cuentaBancariaId: fila.cuenta_bancaria_id,
      nombreArchivo: fila.nombre_archivo,
      totalFilas: fila.total_filas,
      creadoEn: fila.creado_en,
    }),
  );

  const sesiones: SesionListado[] = sesionesFilas.map((fila) => ({
    id: fila.id,
    cuentaBancariaId: fila.cuenta_bancaria_id,
    fechaCorte: fila.fecha_corte,
    saldoExtracto: Number(fila.saldo_extracto),
    saldoLibros: Number(fila.saldo_libros),
    diferencia: Number(fila.diferencia),
    estado: fila.estado === "closed" ? "closed" : "open",
    cerradaEn: fila.cerrada_en,
  }));

  const rol = contexto.rolActivo;
  const puedeGestionar =
    rol === "admin_global" || rol === "admin_empresa" || rol === "contador";
  const puedeOperar = puedeGestionar || rol === "auxiliar";

  return (
    <BancosVista
      empresaId={empresa.id}
      moneda={moneda}
      cuentas={cuentas}
      movimientos={movimientos}
      importaciones={importaciones}
      sesiones={sesiones}
      opcionesCuentasContables={opcionesCuentasContables}
      filtros={{ cuenta: filtroCuenta, desde, hasta }}
      puedeGestionar={puedeGestionar}
      puedeOperar={puedeOperar}
    />
  );
}
