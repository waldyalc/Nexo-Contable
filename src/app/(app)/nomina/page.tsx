import { SinEmpresaActiva } from "@/components/comunes/sin-empresa";
import {
  type CorridaNominaListado,
  type EmpleadoListado,
  NominaVista,
} from "@/components/nomina/nomina-vista";
import { obtenerContextoApp } from "@/lib/auth/sesion";
import { cargarOpcionesCuentas } from "@/lib/datos/cuentas";
import type { Moneda } from "@/lib/formato";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Recursos humanos y nómina · Nexo Contable",
};

interface EmpleadoFila {
  id: string;
  codigo: string;
  nombre: string;
  cedula: string;
  cargo: string;
  departamento: string;
  fecha_ingreso: string;
  salario_mensual: number;
  activo: boolean;
}

interface CorridaFila {
  id: string;
  periodo: string;
  fecha_pago: string;
  descripcion: string;
  total_bruto: number;
  total_deducciones: number;
  total_neto: number;
  detalles: unknown;
  estado: string;
}

export default async function NominaPage() {
  const contexto = await obtenerContextoApp();
  const empresa = contexto.empresaActiva;

  if (!empresa) {
    return (
      <SinEmpresaActiva descripcion="Selecciona o crea una empresa para administrar sus empleados y corridas de nómina." />
    );
  }

  const supabase = await createClient();
  const moneda: Moneda = empresa.monedaFuncional === "USD" ? "USD" : "DOP";

  const [empleadosFilas, corridasFilas, opcionesCuentas] = await Promise.all([
    paginarConsulta<EmpleadoFila>(async (desde, hasta) => {
      const { data, error } = await supabase
        .from("empleados")
        .select(
          "id, codigo, nombre, cedula, cargo, departamento, fecha_ingreso, salario_mensual, activo",
        )
        .eq("empresa_id", empresa.id)
        .order("codigo", { ascending: true })
        .order("id", { ascending: true })
        .range(desde, hasta);
      return { data: (data as EmpleadoFila[] | null) ?? null, error };
    }),
    paginarConsulta<CorridaFila>(async (desde, hasta) => {
      const { data, error } = await supabase
        .from("corridas_nomina")
        .select(
          "id, periodo, fecha_pago, descripcion, total_bruto, total_deducciones, total_neto, detalles, estado",
        )
        .eq("empresa_id", empresa.id)
        .order("periodo", { ascending: false })
        .order("id", { ascending: false })
        .range(desde, hasta);
      return { data: (data as CorridaFila[] | null) ?? null, error };
    }),
    cargarOpcionesCuentas(supabase, empresa.id),
  ]);

  const empleados: EmpleadoListado[] = empleadosFilas.map((fila) => ({
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    cedula: fila.cedula,
    cargo: fila.cargo,
    departamento: fila.departamento,
    fechaIngreso: fila.fecha_ingreso,
    salarioMensual: Number(fila.salario_mensual),
    activo: fila.activo,
  }));

  const corridas: CorridaNominaListado[] = corridasFilas.map((fila) => ({
    id: fila.id,
    periodo: fila.periodo,
    fechaPago: fila.fecha_pago,
    descripcion: fila.descripcion,
    totalBruto: Number(fila.total_bruto),
    totalDeducciones: Number(fila.total_deducciones),
    totalNeto: Number(fila.total_neto),
    estado:
      fila.estado === "void"
        ? "void"
        : fila.estado === "draft"
          ? "draft"
          : "posted",
  }));

  const rol = contexto.rolActivo;
  const puedeGestionar =
    rol === "admin_global" || rol === "admin_empresa" || rol === "contador";

  return (
    <NominaVista
      key={empresa.id}
      empresaId={empresa.id}
      moneda={moneda}
      empleados={empleados}
      corridas={corridas}
      opcionesCuentas={opcionesCuentas}
      puedeGestionar={puedeGestionar}
    />
  );
}
