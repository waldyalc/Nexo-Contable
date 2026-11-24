import {
  EsqueletoEncabezado,
  EsqueletoGrafico,
  EsqueletoLista,
  EsqueletoTabla,
  EsqueletoTarjetas,
} from "@/components/carga/esqueletos";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <>
      <EsqueletoEncabezado
        titulo="Resumen"
        descripcion="Bienvenido a Nexo Contable."
        acciones={1}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-full rounded-[10px] sm:w-64" />
          <Skeleton className="h-9 w-24 rounded-[10px]" />
          <Skeleton className="h-9 w-24 rounded-[10px]" />
        </div>
        <Skeleton className="h-3 w-44 rounded-[6px]" />
      </div>

      <EsqueletoTarjetas cantidad={6} className="xl:grid-cols-3" />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <EsqueletoGrafico
          titulo="Ingresos vs. gastos"
          descripcion="Últimos 6 meses de la empresa activa."
          alto={280}
        />
        <EsqueletoLista
          titulo="Composición del resultado"
          descripcion="Según el estado de resultados del rango."
          filas={4}
          conIconos={false}
        />
      </div>

      <EsqueletoTabla
        titulo="Últimos asientos"
        descripcion="Movimientos contables más recientes de la empresa."
        columnas={4}
        filas={8}
      />
    </>
  );
}
