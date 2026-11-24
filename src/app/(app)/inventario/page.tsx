import { SinEmpresaActiva } from "@/components/comunes/sin-empresa";
import {
  type ArticuloListado,
  InventarioVista,
  type MovimientoInventarioListado,
} from "@/components/inventario/inventario-vista";
import { obtenerContextoApp } from "@/lib/auth/sesion";
import { cargarOpcionesCuentas } from "@/lib/datos/cuentas";
import type { Moneda } from "@/lib/formato";
import { UUID_NULO, esUuid, parametroUrl } from "@/lib/parametros";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Inventario · Nexo Contable",
};

interface ArticuloFila {
  id: string;
  sku: string;
  nombre: string;
  descripcion: string;
  unidad: string;
  cantidad_disponible: number;
  costo_promedio: number;
  valor_total: number;
  precio_venta: number;
  cuenta_inventario_id: string | null;
  cuenta_costo_id: string | null;
  cuenta_ingreso_id: string | null;
  activo: boolean;
}

interface MovimientoFila {
  id: string;
  articulo_id: string;
  fecha: string;
  tipo: string;
  cantidad: number;
  costo_unitario: number;
  costo_total: number;
  referencia: string;
  notas: string;
}

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const contexto = await obtenerContextoApp();
  const empresa = contexto.empresaActiva;

  if (!empresa) {
    return (
      <SinEmpresaActiva descripcion="Selecciona o crea una empresa para administrar su inventario y kardex." />
    );
  }

  const params = await searchParams;
  const articuloParam = parametroUrl(params, "articulo");
  const filtroArticulo = esUuid(articuloParam) ? articuloParam : "";

  const supabase = await createClient();
  const moneda: Moneda = empresa.monedaFuncional === "USD" ? "USD" : "DOP";

  const articulosFilas = await paginarConsulta<ArticuloFila>(
    async (desde, hasta) => {
      const { data, error } = await supabase
        .from("articulos_inventario")
        .select(
          "id, sku, nombre, descripcion, unidad, cantidad_disponible, costo_promedio, valor_total, precio_venta, cuenta_inventario_id, cuenta_costo_id, cuenta_ingreso_id, activo",
        )
        .eq("empresa_id", empresa.id)
        .order("sku", { ascending: true })
        .order("id", { ascending: true })
        .range(desde, hasta);
      return { data: (data as ArticuloFila[] | null) ?? null, error };
    },
  );

  const idsArticulos = articulosFilas.map((articulo) => articulo.id);
  const idsMovimientos =
    filtroArticulo !== ""
      ? [filtroArticulo]
      : idsArticulos.length > 0
        ? idsArticulos
        : [UUID_NULO];

  const [movimientosConsulta, opcionesCuentas] = await Promise.all([
    supabase
      .from("movimientos_inventario")
      .select(
        "id, articulo_id, fecha, tipo, cantidad, costo_unitario, costo_total, referencia, notas",
      )
      .eq("empresa_id", empresa.id)
      .in("articulo_id", idsMovimientos)
      .order("fecha", { ascending: false })
      .order("id", { ascending: false })
      .range(0, 499),
    cargarOpcionesCuentas(supabase, empresa.id),
  ]);

  const articulos: ArticuloListado[] = articulosFilas.map((fila) => ({
    id: fila.id,
    sku: fila.sku,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    unidad: fila.unidad,
    cantidadDisponible: Number(fila.cantidad_disponible),
    costoPromedio: Number(fila.costo_promedio),
    valorTotal: Number(fila.valor_total),
    precioVenta: Number(fila.precio_venta),
    cuentaInventarioId: fila.cuenta_inventario_id ?? "",
    cuentaCostoId: fila.cuenta_costo_id ?? "",
    cuentaIngresoId: fila.cuenta_ingreso_id ?? "",
    activo: fila.activo,
  }));

  const movimientosFilas =
    (movimientosConsulta.data as MovimientoFila[] | null) ?? [];
  const movimientos: MovimientoInventarioListado[] = movimientosFilas.map(
    (fila) => ({
      id: fila.id,
      articuloId: fila.articulo_id,
      fecha: fila.fecha,
      tipo: fila.tipo,
      cantidad: Number(fila.cantidad),
      costoUnitario: Number(fila.costo_unitario),
      costoTotal: Number(fila.costo_total),
      referencia: fila.referencia,
      notas: fila.notas,
    }),
  );

  const rol = contexto.rolActivo;
  const puedeGestionar =
    rol === "admin_global" || rol === "admin_empresa" || rol === "contador";
  const puedeOperar = puedeGestionar || rol === "auxiliar";

  return (
    <InventarioVista
      empresaId={empresa.id}
      moneda={moneda}
      articulos={articulos}
      movimientos={movimientos}
      opcionesCuentas={opcionesCuentas}
      filtroArticulo={filtroArticulo}
      puedeGestionar={puedeGestionar}
      puedeOperar={puedeOperar}
    />
  );
}
