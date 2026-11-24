import {
  EsqueletoEncabezado,
  EsqueletoPestanas,
  EsqueletoTabla,
} from "@/components/carga/esqueletos";
import { Skeleton } from "@/components/ui/skeleton";

export default function ImpuestosLoading() {
  return (
    <>
      <EsqueletoEncabezado
        titulo="Impuestos"
        descripcion="Formatos 606/607, secuencias NCF y e-CF, configuración fiscal y obligaciones de la DGII."
      />
      <EsqueletoPestanas cantidad={4} />

      <div className="flex flex-col gap-4">
        <div className="overflow-hidden rounded-[15px] border border-border bg-card shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-1 px-4 py-3">
            <h2 className="font-display text-base font-semibold tracking-[-0.02em] text-foreground">
              Formatos DGII
            </h2>
            <Skeleton className="h-3 w-44 rounded-[6px]" />
          </div>
          <div className="border-t border-border px-4 py-2">
            <Skeleton className="h-9 w-52 rounded-[10px]" />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2.5">
            <Skeleton className="h-9 w-64 rounded-[10px]" />
            <Skeleton className="h-9 w-28 rounded-[10px]" />
            <Skeleton className="h-9 w-64 rounded-[10px]" />
            <Skeleton className="h-9 w-28 rounded-[10px]" />
          </div>
        </div>

        <EsqueletoTabla
          titulo="606 · Compras y gastos"
          columnas={8}
          filas={6}
        />
        <EsqueletoTabla titulo="607 · Ventas" columnas={8} filas={6} />
      </div>
    </>
  );
}
