import {
  type ActivoFijoListado,
  ActivosFijosVista,
  type DepreciacionListado,
} from "@/components/activos-fijos/activos-fijos-vista";
import { SinEmpresaActiva } from "@/components/comunes/sin-empresa";
import { obtenerContextoApp } from "@/lib/auth/sesion";
import { cargarOpcionesCuentas } from "@/lib/datos/cuentas";
import type { Moneda } from "@/lib/formato";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Activos fijos · Nexo Contable",
};

interface ActivoFila {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  fecha_adquisicion: string;
  costo_adquisicion: number;
  valor_residual: number;
  vida_util_meses: number;
  depreciacion_acumulada: number;
  cuenta_activo_id: string;
  cuenta_depreciacion_acumulada_id: string;
  cuenta_gasto_depreciacion_id: string;
  estado: string;
}

interface DepreciacionFila {
  id: string;
  activo_id: string;
  periodo: string;
  fecha: string;
  monto: number;
}

export default async function ActivosFijosPage() {
  const contexto = await obtenerContextoApp();
  const empresa = contexto.empresaActiva;

  if (!empresa) {
    return (
      <SinEmpresaActiva descripcion="Selecciona o crea una empresa para administrar sus activos fijos y depreciaciones." />
    );
  }

  const supabase = await createClient();
  const moneda: Moneda = empresa.monedaFuncional === "USD" ? "USD" : "DOP";

  const [activosFilas, depreciacionesConsulta, opcionesCuentas] =
    await Promise.all([
      paginarConsulta<ActivoFila>(async (desde, hasta) => {
        const { data, error } = await supabase
          .from("activos_fijos")
          .select(
            "id, codigo, nombre, categoria, fecha_adquisicion, costo_adquisicion, valor_residual, vida_util_meses, depreciacion_acumulada, cuenta_activo_id, cuenta_depreciacion_acumulada_id, cuenta_gasto_depreciacion_id, estado",
          )
          .eq("empresa_id", empresa.id)
          .order("codigo", { ascending: true })
          .order("id", { ascending: true })
          .range(desde, hasta);
        return { data: (data as ActivoFila[] | null) ?? null, error };
      }),
      supabase
        .from("depreciaciones_activos")
        .select("id, activo_id, periodo, fecha, monto")
        .eq("empresa_id", empresa.id)
        .order("fecha", { ascending: false })
        .order("id", { ascending: false })
        .range(0, 499),
      cargarOpcionesCuentas(supabase, empresa.id),
    ]);

  const activos: ActivoFijoListado[] = activosFilas.map((fila) => ({
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    categoria: fila.categoria,
    fechaAdquisicion: fila.fecha_adquisicion,
    costoAdquisicion: Number(fila.costo_adquisicion),
    valorResidual: Number(fila.valor_residual),
    vidaUtilMeses: fila.vida_util_meses,
    depreciacionAcumulada: Number(fila.depreciacion_acumulada),
    cuentaActivoId: fila.cuenta_activo_id,
    cuentaDepreciacionAcumuladaId: fila.cuenta_depreciacion_acumulada_id,
    cuentaGastoDepreciacionId: fila.cuenta_gasto_depreciacion_id,
    estado:
      fila.estado === "fully_depreciated" || fila.estado === "disposed"
        ? fila.estado
        : "active",
  }));

  const depreciacionesFilas =
    (depreciacionesConsulta.data as DepreciacionFila[] | null) ?? [];
  const depreciaciones: DepreciacionListado[] = depreciacionesFilas.map(
    (fila) => ({
      id: fila.id,
      activoId: fila.activo_id,
      periodo: fila.periodo,
      fecha: fila.fecha,
      monto: Number(fila.monto),
    }),
  );

  const rol = contexto.rolActivo;
  const puedeGestionar =
    rol === "admin_global" || rol === "admin_empresa" || rol === "contador";

  return (
    <ActivosFijosVista
      key={empresa.id}
      empresaId={empresa.id}
      moneda={moneda}
      activos={activos}
      depreciaciones={depreciaciones}
      opcionesCuentas={opcionesCuentas}
      puedeGestionar={puedeGestionar}
    />
  );
}
